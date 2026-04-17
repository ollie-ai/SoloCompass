import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GithubStrategy } from 'passport-github2';
import crypto from 'crypto';
import dotenv from 'dotenv';
import db from '../db.js';
import logger from '../services/logger.js';

dotenv.config();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3005';

const googleStateStore = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000;

const createGoogleState = () => {
  const state = crypto.randomBytes(32).toString('hex');
  googleStateStore.set(state, { expiresAt: Date.now() + STATE_EXPIRY_MS });
  setTimeout(() => googleStateStore.delete(state), STATE_EXPIRY_MS);
  return state;
};

export const validateGoogleState = (state) => {
  const data = googleStateStore.get(state);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    googleStateStore.delete(state);
    return false;
  }
  googleStateStore.delete(state);
  return true;
};

export const generateGoogleState = createGoogleState;

export const configurePassport = () => {
  // Google OAuth - Required
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (googleClientId && googleClientSecret) {
    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: `${backendUrl}/api/auth/google/callback`,
      proxy: true,
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile) {
          return done(new Error('OAuth failed: no profile received'), null);
        }
        
        const profileEmail = profile.emails?.[0]?.value;
        if (!profileEmail) {
          return done(new Error('OAuth failed: no email in profile'), null);
        }
        const email = profileEmail.toLowerCase().trim();
        
        let user = await db.get('SELECT * FROM users WHERE email = $1', email);
        
        if (!user) {
          const result = await db.run(
            'INSERT INTO users (email, password, name, role, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            email, 'social_login_locked', profile.displayName || 'Google User', 'user', true
          );
          const userId = result.lastInsertRowid;
          
          await db.run('INSERT INTO profiles (user_id) VALUES ($1)', userId);
          user = await db.get('SELECT * FROM users WHERE id = $1', userId);
        } else if (!user.email_verified) {
          await db.run('UPDATE users SET email_verified = true WHERE id = $1', user.id);
          user.email_verified = true;
        }
        
        if (!user) {
          return done(new Error('OAuth failed: could not create or retrieve user'), null);
        }
        
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }));
    logger.info('[OAuth] Google Strategy configured');
  } else {
    logger.warn('[OAuth] Google credentials not configured - Google login disabled');
  }

  // GitHub OAuth - Optional
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  if (githubClientId && githubClientSecret) {
    passport.use(new GithubStrategy({
      clientID: githubClientId,
      clientSecret: githubClientSecret,
      callbackURL: `${backendUrl}/api/auth/github/callback`,
      scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile) {
          return done(new Error('OAuth failed: no profile received'), null);
        }
        
        const profileEmail = profile.emails?.[0]?.value || `${profile.username}@github.com`;
        if (!profileEmail) {
          return done(new Error('OAuth failed: no email in profile'), null);
        }
        const email = profileEmail.toLowerCase().trim();
        
        let user = await db.get('SELECT * FROM users WHERE email = $1', email);
        
        if (!user) {
          const result = await db.run(
            'INSERT INTO users (email, password, name, role, email_verified) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            email, 'social_login_locked', profile.displayName || profile.username || 'GitHub User', 'user', true
          );
          const userId = result.lastInsertRowid;
          
          await db.run('INSERT INTO profiles (user_id) VALUES ($1)', userId);
          user = await db.get('SELECT * FROM users WHERE id = $1', userId);
        } else if (!user.email_verified) {
          await db.run('UPDATE users SET email_verified = true WHERE id = $1', user.id);
          user.email_verified = true;
        }
        
        if (!user) {
          return done(new Error('OAuth failed: could not create or retrieve user'), null);
        }
        
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }));
    logger.info('[OAuth] GitHub Strategy configured');
  } else {
    logger.warn('[OAuth] GitHub credentials not configured - GitHub login disabled');
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE id = $1', id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

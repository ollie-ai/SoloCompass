/**
 * Lighthouse CI configuration
 * Scores are evaluated against built assets served by a temporary server.
 * All four categories must score >= 90 to pass.
 *
 * Usage: npx lhci autorun
 */

module.exports = {
  ci: {
    collect: {
      staticDistDir: './frontend/dist',
      numberOfRuns: 1,
      url: ['http://localhost/'],
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

import { User, Smile } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatMessage } from './formatMessage';

/**
 * AtlasMessage — renders a single user or assistant chat message bubble.
 *
 * Props:
 *  message — { role: 'user' | 'assistant', content: string }
 */
export default function AtlasMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isUser
              ? 'bg-gradient-to-br from-brand-vibrant to-brand-accent'
              : 'bg-base-300 border border-base-300'
          }`}
        >
          {isUser ? (
            <User size={14} className="text-white" />
          ) : (
            <Smile size={14} className="text-base-content/80" />
          )}
        </div>
        <div
          className={`p-3 rounded-2xl text-sm font-medium leading-relaxed ${
            isUser
              ? 'bg-success/100 text-white rounded-br-md shadow-lg'
              : 'bg-base-100 border border-base-300 text-base-content rounded-bl-md shadow-sm'
          }`}
        >
          {formatMessage(message.content, isUser)}
        </div>
      </div>
    </motion.div>
  );
}

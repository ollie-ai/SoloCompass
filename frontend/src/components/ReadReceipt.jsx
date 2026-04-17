import { memo } from 'react';
import PropTypes from 'prop-types';
import { Check, CheckCheck } from 'lucide-react';

const ReadReceipt = memo(function ReadReceipt({ status = 'sent', readAt }) {
  if (status === 'read') {
    return (
      <span
        className="inline-flex items-center"
        title={readAt ? `Read ${new Date(readAt).toLocaleString()}` : 'Read'}
      >
        <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center" title="Delivered">
        <CheckCheck className="w-3.5 h-3.5 text-base-content/40" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center" title="Sent">
      <Check className="w-3.5 h-3.5 text-base-content/40" />
    </span>
  );
});

ReadReceipt.displayName = 'ReadReceipt';

ReadReceipt.propTypes = {
  status: PropTypes.oneOf(['sent', 'delivered', 'read']),
  readAt: PropTypes.string,
};

export default ReadReceipt;

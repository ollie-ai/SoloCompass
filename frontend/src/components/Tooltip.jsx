import { memo } from 'react';
import PropTypes from 'prop-types';

const positionClasses = {
  top: 'tooltip-top',
  bottom: 'tooltip-bottom',
  left: 'tooltip-left',
  right: 'tooltip-right',
};

const Tooltip = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  return (
    <div
      className={`tooltip ${positionClasses[position]} ${className}`}
      data-tip={content}
    >
      {children}
    </div>
  );
};

Tooltip.propTypes = {
  content: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  className: PropTypes.string,
};

export default memo(Tooltip);

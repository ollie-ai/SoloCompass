import { memo } from 'react';
import PropTypes from 'prop-types';

const variantClasses = {
  default: 'tabs',
  boxed: 'tabs tabs-boxed',
  bordered: 'tabs tabs-bordered',
  lifted: 'tabs tabs-lifted',
};

const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  variant = 'default',
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={`${variantClasses[variant]} ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`
            tab gap-2 font-medium transition-colors
            ${activeTab === tab.id ? 'tab-active' : ''}
          `}
        >
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
    })
  ),
  activeTab: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['default', 'boxed', 'bordered', 'lifted']),
  className: PropTypes.string,
};

export default memo(Tabs);

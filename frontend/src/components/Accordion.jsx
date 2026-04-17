import { memo, useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

const AccordionItem = memo(({ item, isOpen, onToggle }) => {
  return (
    <div className="border border-base-300/50 rounded-xl overflow-hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`accordion-panel-${item.id}`}
        id={`accordion-header-${item.id}`}
        onClick={() => onToggle(item.id)}
        className="
          w-full flex items-center justify-between px-5 py-4
          text-left font-medium text-base-content
          bg-base-100 hover:bg-base-200/60
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset
          transition-colors duration-200
        "
      >
        <span>{item.title}</span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-base-content/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        id={`accordion-panel-${item.id}`}
        role="region"
        aria-labelledby={`accordion-header-${item.id}`}
        hidden={!isOpen}
        className="px-5 py-4 bg-base-100 border-t border-base-300/50 text-base-content/80"
      >
        {item.content ?? item.children}
      </div>
    </div>
  );
});

AccordionItem.displayName = 'AccordionItem';

AccordionItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.node,
    children: PropTypes.node,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const Accordion = ({
  items = [],
  defaultOpen = [],
  allowMultiple = false,
  className = '',
}) => {
  const [openIds, setOpenIds] = useState(() => new Set(defaultOpen));

  const handleToggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          item={item}
          isOpen={openIds.has(item.id)}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
};

Accordion.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      content: PropTypes.node,
      children: PropTypes.node,
    })
  ),
  defaultOpen: PropTypes.arrayOf(PropTypes.string),
  allowMultiple: PropTypes.bool,
  className: PropTypes.string,
};

export default memo(Accordion);

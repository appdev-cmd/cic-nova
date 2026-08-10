import { useEffect } from 'react';

export function AccessibilityBridge() {
  useEffect(() => {
    let fieldIndex = 0;
    const enhance = (root: ParentNode) => {
      root.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(label => {
        const container = label.parentElement;
        const field = container?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
        if (!field || field.closest('label')) return;
        if (!field.id) field.id = `nova-field-${Date.now()}-${fieldIndex++}`;
        label.htmlFor = field.id;
      });
    };

    enhance(document);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof Element) enhance(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

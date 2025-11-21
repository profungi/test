'use client';

import { useState, useRef, useEffect } from 'react';

interface EventDescriptionPopoverProps {
  description: string;
  children: React.ReactNode;
}

export default function EventDescriptionPopover({ description, children }: EventDescriptionPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭 popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        triggerRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* 触发区域 */}
      <div
        ref={triggerRef}
        className="group cursor-pointer"
        onClick={handleToggle}
      >
        {children}

        {/* 桌面端悬停显示的 popover */}
        <div className="hidden hover-device:group-hover:block absolute z-50 w-[65ch] max-w-[90vw] bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-xl p-4 mt-2 left-0">
          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
            {description}
          </div>
          <div className="absolute -top-2 left-4 w-4 h-4 bg-white/95 border-l border-t border-gray-300 transform rotate-45"></div>
        </div>
      </div>

      {/* 移动端/触摸设备点击显示的 popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="hover-device:hidden fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
        >
          {/* 关闭按钮 */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>

          {/* 完整描述 */}
          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words pr-8">
            {description}
          </div>
        </div>
      )}

      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="hover-device:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';

interface EventDescriptionPopoverProps {
  description: string;
  children: React.ReactNode;
}

export default function EventDescriptionPopover({ description, children }: EventDescriptionPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<'left' | 'right'>('left');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检测是否为触摸设备
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

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

  const handleMouseEnter = () => {
    if (!isTouchDevice) {
      // 计算 popover 应该显示在左边还是右边
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const popoverWidth = 65 * 8; // 65ch 大约等于 65 * 8px（假设字符宽度约8px）

        // 如果右边空间不够，就显示在左边（右对齐）
        if (rect.left + popoverWidth > viewportWidth - 20) {
          setPopoverPosition('right');
        } else {
          setPopoverPosition('left');
        }
      }

      // 桌面端：延迟显示，避免误触
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 200);
    }
  };

  const handleMouseLeave = () => {
    if (!isTouchDevice) {
      // 清除延迟定时器
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setIsHovered(false);
    }
  };

  const handleClick = () => {
    // 触摸设备：点击切换
    if (isTouchDevice) {
      setIsOpen(!isOpen);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* 触发区域 */}
      <div
        ref={triggerRef}
        className="cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}

        {/* 桌面端悬停显示的 popover */}
        {!isTouchDevice && isHovered && (
          <div className={`absolute z-50 w-[65ch] max-w-[90vw] bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-xl p-4 mt-2 ${popoverPosition === 'right' ? 'right-0' : 'left-0'}`}>
            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
              {description}
            </div>
            <div className={`absolute -top-2 w-4 h-4 bg-white/95 border-l border-t border-gray-300 transform rotate-45 ${popoverPosition === 'right' ? 'right-4' : 'left-4'}`}></div>
          </div>
        )}
      </div>

      {/* 移动端/触摸设备点击显示的 popover */}
      {isTouchDevice && isOpen && (
        <>
          <div
            ref={popoverRef}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
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

          {/* 移动端遮罩层 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
}

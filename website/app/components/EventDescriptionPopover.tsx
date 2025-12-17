'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface EventDescriptionPopoverProps {
  description: string;
  children: React.ReactNode;
}

export default function EventDescriptionPopover({ description, children }: EventDescriptionPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<'left' | 'right'>('left');
  const [verticalPosition, setVerticalPosition] = useState<'below' | 'above'>('below');
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检测是否为触摸设备
  useEffect(() => {
    setMounted(true);
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
    if (!isTouchDevice && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverWidth = 520; // 65ch 大约等于 520px
      const popoverHeight = 280; // 估算的 popover 高度（max-h-60 = 240px + padding）

      // 计算水平位置
      let left = rect.left;
      let position: 'left' | 'right' = 'left';

      // 如果右边空间不够，就显示在右边（右对齐）
      if (rect.left + popoverWidth > viewportWidth - 20) {
        position = 'right';
        left = rect.right - popoverWidth;
        // 确保不超出左边界
        if (left < 20) {
          left = 20;
        }
      }

      // 计算垂直位置（fixed 定位使用视口坐标，不需要 scrollY）
      let top: number;
      let vPosition: 'below' | 'above' = 'below';

      // 检查下方空间是否足够
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        // 下方空间不够，且上方空间更大，显示在上方
        vPosition = 'above';
        top = rect.top - popoverHeight - 8;
        // 确保不超出顶部
        if (top < 10) {
          top = 10;
        }
      } else {
        // 显示在下方
        top = rect.bottom + 8;
        // 确保不超出底部
        if (top + popoverHeight > viewportHeight - 10) {
          top = viewportHeight - popoverHeight - 10;
        }
      }

      setPopoverPosition(position);
      setVerticalPosition(vPosition);
      setPopoverStyle({
        top: top,
        left: left,
      });

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
    <>
      {/* 触发区域 */}
      <div
        ref={triggerRef}
        className="cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>

      {/* 使用 Portal 渲染 popover 到 body */}
      {mounted && (
        <>
          {/* 桌面端悬停显示的 popover */}
          {!isTouchDevice && isHovered && createPortal(
            <div
              className="fixed w-[520px] max-w-[90vw] bg-white border-2 border-[#F0D3B6] rounded-xl shadow-2xl p-4"
              style={{
                zIndex: 99999,
                top: `${popoverStyle.top}px`,
                left: `${popoverStyle.left}px`,
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                }
                setIsHovered(true);
              }}
              onMouseLeave={handleMouseLeave}
            >
              <div className="text-sm text-[#4A2C22] whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                {description}
              </div>
              {/* 箭头：根据垂直位置决定显示在顶部还是底部 */}
              {verticalPosition === 'below' ? (
                <div
                  className={`absolute -top-2 w-4 h-4 bg-white border-l-2 border-t-2 border-[#F0D3B6] transform rotate-45 ${popoverPosition === 'right' ? 'right-4' : 'left-4'}`}
                ></div>
              ) : (
                <div
                  className={`absolute -bottom-2 w-4 h-4 bg-white border-r-2 border-b-2 border-[#F0D3B6] transform rotate-45 ${popoverPosition === 'right' ? 'right-4' : 'left-4'}`}
                ></div>
              )}
            </div>,
            document.body
          )}

          {/* 移动端/触摸设备点击显示的 popover */}
          {isTouchDevice && isOpen && createPortal(
            <>
              <div
                ref={popoverRef}
                className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white border-2 border-[#F0D3B6] rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
                style={{ zIndex: 99999 }}
              >
                {/* 关闭按钮 */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-3 right-3 text-[#4A2C22]/40 hover:text-[#4A2C22] text-2xl leading-none font-bold"
                  aria-label="Close"
                >
                  ×
                </button>

                {/* 完整描述 */}
                <div className="text-sm text-[#4A2C22] whitespace-pre-wrap break-words pr-8">
                  {description}
                </div>
              </div>

              {/* 移动端遮罩层 */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50"
                style={{ zIndex: 99998 }}
                onClick={() => setIsOpen(false)}
              />
            </>,
            document.body
          )}
        </>
      )}
    </>
  );
}

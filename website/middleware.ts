// 临时测试：不用 next-intl，只看 Edge 正常不正常
import {NextResponse} from 'next/server';

export function middleware() {
  return NextResponse.next();
}
import type { SVGProps } from 'react'
type IconProps = SVGProps<SVGSVGElement> & { size?: number }
export function Mars({ size = 24, strokeWidth = 2, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="9.5" cy="14.5" r="6.5"/><path d="m14 10 7-7m-6 0h6v6"/></svg>
}
export function Venus({ size = 24, strokeWidth = 2, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><circle cx="12" cy="8.5" r="6.5"/><path d="M12 15v7m-4-3h8"/></svg>
}

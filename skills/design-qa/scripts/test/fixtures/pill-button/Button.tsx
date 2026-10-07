export function Button({ children }: { children: React.ReactNode }) {
  return <button className="rounded-full bg-primary px-6 py-3 text-white">{children}</button>;
}

export function IconButton() {
  return <button aria-label="close" className="rounded-full size-10 bg-primary">x</button>;
}

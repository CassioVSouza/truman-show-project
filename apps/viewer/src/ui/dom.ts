// Safe DOM helpers. Resident text is ALWAYS inserted as text nodes (never innerHTML)
// so we never filter Resident content and never risk XSS.

export type Child = Node | string | number | null | undefined | false;

export interface Attrs {
  class?: string;
  id?: string;
  title?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  disabled?: boolean;
  checked?: boolean;
  role?: string;
  "aria-label"?: string;
  style?: string;
  dataset?: Record<string, string>;
  onClick?: (e: MouseEvent) => void;
  onInput?: (e: globalThis.Event) => void;
  onChange?: (e: globalThis.Event) => void;
  onSubmit?: (e: SubmitEvent) => void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    if (attrs.class) node.className = attrs.class;
    if (attrs.id) node.id = attrs.id;
    if (attrs.title) node.title = attrs.title;
    if (attrs.role) node.setAttribute("role", attrs.role);
    if (attrs["aria-label"]) node.setAttribute("aria-label", attrs["aria-label"]);
    if (attrs.style) node.setAttribute("style", attrs.style);
    if (attrs.type) node.setAttribute("type", attrs.type);
    if (attrs.placeholder) node.setAttribute("placeholder", attrs.placeholder);
    if (attrs.min !== undefined) node.setAttribute("min", attrs.min);
    if (attrs.max !== undefined) node.setAttribute("max", attrs.max);
    if (attrs.step !== undefined) node.setAttribute("step", attrs.step);
    if (attrs.value !== undefined && "value" in node) {
      (node as HTMLInputElement).value = attrs.value;
    }
    if (attrs.disabled !== undefined && "disabled" in node) {
      (node as HTMLButtonElement).disabled = attrs.disabled;
    }
    if (attrs.checked !== undefined && "checked" in node) {
      (node as HTMLInputElement).checked = attrs.checked;
    }
    if (attrs.dataset) {
      for (const [k, v] of Object.entries(attrs.dataset)) node.dataset[k] = v;
    }
    if (attrs.onClick) node.addEventListener("click", attrs.onClick as EventListener);
    if (attrs.onInput) node.addEventListener("input", attrs.onInput as EventListener);
    if (attrs.onChange) node.addEventListener("change", attrs.onChange as EventListener);
    if (attrs.onSubmit) node.addEventListener("submit", attrs.onSubmit as EventListener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

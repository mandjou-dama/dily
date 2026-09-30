// headerLogoLayout.ts
export type LogoLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

let layout: LogoLayout | null = null;

export const setHeaderLogoLayout = (l: LogoLayout) => {
  layout = l;
};

export const getHeaderLogoLayout = () => layout;

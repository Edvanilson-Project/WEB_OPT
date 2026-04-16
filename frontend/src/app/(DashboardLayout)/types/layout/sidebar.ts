import type { MouseEvent, ElementType } from "react";

export type NavGroup = {
  subtitle?: string;
  disabled?: boolean;
  id?: string;
  navlabel?: boolean;
  subheader?: string;
  title?: string;
  icon?: ElementType;
  href?: string;
  children?: NavGroup[];
  chip?: string;
  chipColor?: string;
  variant?: string;
  external?: boolean;
  level?: number;

  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

export interface ItemType {
  item: NavGroup;

  onClick: (event: MouseEvent<HTMLElement>) => void;
  hideMenu?: boolean | "";
  level?: number;
  pathDirect: string;
}

export interface NavGroupProps {
  id?: string;
  navlabel?: boolean;
  subheader?: string;
  title?: string;
  icon?: ElementType;
  href?: string;
  children?: NavGroup[];
}

export interface NavCollapseProps {
  menu: NavGroupProps;
  level: number;
  pathWithoutLastPart: string;
  pathDirect: string;
  hideMenu?: boolean | "";

  onClick: (event: MouseEvent<HTMLElement>) => void;
}

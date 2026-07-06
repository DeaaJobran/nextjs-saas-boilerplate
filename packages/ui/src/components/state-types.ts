export type StateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type StateProps = {
  title: string;
  description: string;
  action?: StateAction;
  className?: string;
};

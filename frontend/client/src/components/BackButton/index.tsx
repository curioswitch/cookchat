import { useCallback } from "react";
import { HiArrowLeft } from "react-icons/hi";
import type { IconBaseProps } from "react-icons/lib";

export function BackButton(props: IconBaseProps) {
  const onClick = useCallback(() => {
    window.history.back();
  }, []);
  return <HiArrowLeft onClick={onClick} {...props} />;
}

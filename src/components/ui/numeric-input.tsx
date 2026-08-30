import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

export type NumericInputValue = number | "";

type NumericInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: NumericInputValue;
  onValueChange: (value: NumericInputValue) => void;
};

function NumericInput({ onValueChange, ...props }: NumericInputProps) {
  return (
    <Input
      {...props}
      type="number"
      onChange={(event) =>
        onValueChange(
          event.target.value === "" ? "" : Number(event.target.value),
        )
      }
    />
  );
}

export { NumericInput };

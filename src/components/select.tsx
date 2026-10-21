"use client";
import { useI18n } from "@/i18n/client";
import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import {Children,isValidElement,type ReactNode} from "react";
import {ChoiceGroup} from "./choice-group";

type SelectProps = {
  presentation?:"auto"|"dropdown";
  displayValue?: ReactNode;
  title?: string;
  contentClassName?: string;
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Select({
  value,
  onValueChange,
  children,
  id,
  name,
  disabled,
  required,
  className = "",
  "aria-label": label,
  displayValue,
  title,
  contentClassName = "",
  presentation="auto",
}: SelectProps) {
  const { t: tr } = useI18n();
  const items=Children.toArray(children);
  const options=items.flatMap(child=>{
    if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>(child)||child.type!==SelectOption||child.props.value===undefined)return [];
    return [{value:String(child.props.value),label:child.props.children,disabled:child.props.disabled}];
  });
  if(presentation==="auto"&&displayValue===undefined&&!name&&!required&&options.length>=2&&options.length<=4&&options.length===items.length)
    return <ChoiceGroup id={id} label={label?tr(label):title||tr("Options")} className={"site-choice-select "+className} value={String(value)} onChange={onValueChange} options={options} disabled={disabled}/>;
  return (
    <Primitive.Root
      value={String(value)}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
      required={required}
    >
      <Primitive.Trigger
        id={id}
        title={title}
        aria-label={label ? tr(label) : undefined}
        className={`site-select ${className}`}
      >
        <span className="site-select-value">
          <Primitive.Value>{displayValue}</Primitive.Value>
        </span>
        <Primitive.Icon className="site-select-chevron">
          <ChevronDown size={15} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={`site-select-content ${contentClassName}`}
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          align="start"
        >
          <Primitive.ScrollUpButton className="site-select-scroll">
            <ChevronUp size={14} />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="site-select-viewport">
            {children}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="site-select-scroll">
            <ChevronDown size={14} />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export function SelectOption({
  value,
  children,
  disabled,
  textValue,
}: {
  value: string | number;
  children: ReactNode;
  textValue?: string;
  disabled?: boolean;
}) {
  return (
    <Primitive.Item
      className="site-select-option"
      textValue={textValue}
      value={String(value)}
      disabled={disabled}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="site-select-check">
        <Check size={14} strokeWidth={2.5} />
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}

export function SelectGroup({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  const { t: tr } = useI18n();
  return (
    <Primitive.Group className="site-select-group">
      <Primitive.Label className="site-select-group-label">{tr(label)}</Primitive.Label>
      {children}
    </Primitive.Group>
  );
}

"use client";

import { useState, type ComponentProps } from "react";
import { Icon } from "./Icon";
import { TextField } from "./TextField";

/** TextField with the lock icon and a show/hide toggle. */
export function PasswordField(props: Omit<ComponentProps<typeof TextField>, "type" | "iconLeft" | "iconRight">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      iconLeft={<Icon name="icon-lock" size={18} />}
      iconRight={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex shrink-0 rounded"
        >
          <Icon name={visible ? "icon-eye-off" : "icon-eye"} size={18} />
        </button>
      }
    />
  );
}

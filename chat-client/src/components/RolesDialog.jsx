import { useState } from "react";
import {
  LockIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { PERMISSIONS, useServerStore } from "../store/useServerStore";

// plain english for the permission keys, in the order they matter
const PERMISSION_LABELS = [
  [PERMISSIONS.MANAGE_SERVER, "Manage the server", "Rename it and reset its invite code"],
  [PERMISSIONS.MANAGE_ROLES, "Manage roles", "Create, edit and delete roles"],
  [PERMISSIONS.MANAGE_CHANNELS, "Manage channels", "Create, rename and delete channels"],
  [PERMISSIONS.MANAGE_MEMBERS, "Manage members", "Assign roles and remove members"],
  [PERMISSIONS.MODERATE_MESSAGES, "Moderate messages", "Delete anyone's messages"],
];

const COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#06b6d4", "#94a3b8"];

function RolesDialog({ onClose }) {
  const { roles, can, canManageRole, createRole, updateRole, deleteRole } =
    useServerStore();

  const list = roles();
  const [selectedId, setSelectedId] = useState(list[0]?._id);
  const [isCreating, setIsCreating] = useState(false);

  const role = list.find((r) => r._id === selectedId) || list[0];
  const canManage = can(PERMISSIONS.MANAGE_ROLES);
  const canEdit = canManageRole(role);

  const toggle = (permission) => {
    const permissions = role.permissions.includes(permission)
      ? role.permissions.filter((p) => p !== permission)
      : [...role.permissions, permission];

    updateRole(role._id, { permissions });
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete the ${role.name} role? Everyone holding it falls back to the default role.`,
    );
    if (confirmed) {
      deleteRole(role._id);
      setSelectedId(list.find((r) => r._id !== role._id)?._id);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog-card max-w-3xl "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <ShieldIcon className="size-4 text-brand-soft" />
              Roles and permissions
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {canManage
                ? "Create a role, then switch on what it is allowed to do."
                : "What each role in this server is allowed to do."}
            </p>
          </div>

          <button type="button" onClick={onClose} title="Close" className="icon-btn">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="flex gap-6 px-6 pb-6 max-h-[60vh]">
          {/* the roles this server has, highest first */}
          <div className="w-48 flex-shrink-0 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
            {list.map((entry) => (
              <button
                key={entry._id}
                type="button"
                onClick={() => setSelectedId(entry._id)}
                className={`sidebar-item ${
                  entry._id === role?._id ? "sidebar-item-active" : ""
                }`}
              >
                <span
                  className="size-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate flex-1">{entry.name}</span>
                {entry.isDefault && (
                  <span className="text-[9px] opacity-70 flex-shrink-0">
                    default
                  </span>
                )}
              </button>
            ))}

            {canManage && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="sidebar-item text-brand-soft hover:text-brand-soft"
              >
                <PlusIcon className="size-4" />
                New role
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin space-y-2 px-2">
            {role && (
              <>
                <div className="flex items-center gap-3 pb-2">
                  <h3 className="text-slate-100 font-medium truncate flex-1">
                    {role.name}
                  </h3>

                  {canEdit && !role.isSystem && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      title="Delete this role"
                      className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 pb-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateRole(role._id, { color })}
                        title={`Use ${color}`}
                        style={{ backgroundColor: color }}
                        className={`size-5 rounded-full cursor-pointer transition-transform ${
                          role.color === color
                            ? "ring-2 ring-offset-2 ring-offset-surface-2 ring-white scale-110"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                )}

                {PERMISSION_LABELS.map(([key, label, detail]) => (
                  <div
                    key={key}
                    className="flex items-center gap-4 p-3 rounded-lg bg-surface-1 border border-edge"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200 text-sm font-medium">{label}</p>
                      <p className="text-slate-500 text-xs">{detail}</p>
                    </div>

                    <Toggle
                      on={role.permissions.includes(key)}
                      disabled={!canEdit}
                      label={`${label} for ${role.name}`}
                      onChange={() => toggle(key)}
                    />
                  </div>
                ))}

                <p className="flex items-start gap-2 text-slate-500 text-xs pt-2">
                  <LockIcon className="size-3.5 flex-shrink-0 mt-0.5" />
                  {!canEdit && canManage
                    ? "You cannot shape the role you hold yourself, or one above it."
                    : role.isSystem
                      ? "This role is built in: it can be reshaped but not renamed or deleted."
                      : "Nobody can grant a permission they do not hold themselves."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {isCreating && (
        <CreateRoleForm
          onCreate={createRole}
          onClose={() => setIsCreating(false)}
          colors={COLORS}
        />
      )}
    </div>
  );
}

function CreateRoleForm({ onCreate, onClose, colors }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // a new role starts with nothing, its permissions are switched on after
    const created = await onCreate({ name: name.trim(), color, permissions: [] });
    setIsSaving(false);
    if (created) onClose();
  };

  return (
    // a lighter scrim than .dialog-backdrop: the roles dialog underneath is
    // already dimming the page, and two of them stack up almost black
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="dialog-card max-w-sm p-6 space-y-5"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Create a role</h2>
          <p className="text-slate-400 text-sm mt-1">
            It starts with no permissions, switch them on next.
          </p>
        </div>

        <div>
          <label className="field-label">Role name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="Release manager"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label">Colour</label>
          <div className="flex items-center gap-2">
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                style={{ backgroundColor: option }}
                title={`Use ${option}`}
                className={`size-6 rounded-full cursor-pointer transition-transform ${
                  color === option
                    ? "ring-2 ring-offset-2 ring-offset-surface-2 ring-white scale-110"
                    : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ghost-btn">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="primary-btn"
          >
            Create role
          </button>
        </div>
      </form>
    </div>
  );
}

function Toggle({ on, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${
        on ? "bg-brand" : "bg-surface-4"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white transition-all ${
          on ? "left-5" : "left-1"
        }`}
      />
    </button>
  );
}

export default RolesDialog;

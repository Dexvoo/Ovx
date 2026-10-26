// Form controls and the unsaved-changes save bar shared by settings pages.
import { el, staticSvg, ICONS } from './ui.js';

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

/** A titled section of a settings page. */
export function card(title, description, children) {
    return el('section', { className: 'card settings-card' }, [
        el('h2', { className: 'card-title', textContent: title }),
        description && el('p', { className: 'card-description', textContent: description }),
        ...children,
    ]);
}

/**
 * A labelled row: label and help text on the left, control on the right.
 * @param {{ label: string, description?: string, control: HTMLElement, id?: string, stacked?: boolean }} options
 */
export function field({ label, description, control, id, stacked = false }) {
    return el('div', { className: `field${stacked ? ' field-stacked' : ''}` }, [
        el('div', { className: 'field-text' }, [
            el('label', { className: 'field-label', textContent: label, for: id ?? '' }),
            description && el('p', { className: 'field-description', textContent: description }),
        ]),
        el('div', { className: 'field-control' }, [control]),
    ]);
}

/**
 * On/off switch (a real checkbox underneath, so it works with keyboards and screen readers).
 * @param {{ checked: boolean, onChange: (checked: boolean) => void, label: string, id?: string }} options
 */
export function toggle({ checked, onChange, label, id = nextId('toggle') }) {
    const input = el('input', { type: 'checkbox', className: 'toggle-input', id, checked, 'aria-label': label });
    input.addEventListener('change', () => onChange(input.checked));
    const wrap = el('span', { className: 'toggle' }, [
        input,
        el('span', { className: 'toggle-track', 'aria-hidden': 'true' }),
    ]);
    wrap.dataset.for = id;
    return wrap;
}

/**
 * Channel dropdown, grouped by category.
 * @param {{ channels: any[], value: string | null, onChange: (id: string | null) => void, noneLabel?: string,
 *   types?: string[], requirePost?: boolean, id?: string }} options
 */
export function channelSelect({
    channels,
    value,
    onChange,
    noneLabel = 'No channel',
    types = ['text'],
    requirePost = true,
    id,
}) {
    const select = el('select', { className: 'select', id });
    select.append(el('option', { value: '', textContent: noneLabel }));

    const groups = new Map();
    for (const channel of channels.filter((c) => types.includes(c.type))) {
        const key = channel.category ?? '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(channel);
    }

    for (const [category, list] of groups) {
        const parent = category ? el('optgroup', { label: category }) : select;
        for (const channel of list) {
            const blocked = requirePost && !channel.botCanPost;
            parent.append(
                el('option', {
                    value: channel.id,
                    textContent: `${channel.type === 'voice' ? '🔊 ' : '# '}${channel.name}${blocked ? ' — Ovx can’t post here' : ''}`,
                    disabled: blocked && channel.id !== value,
                })
            );
        }
        if (category) select.append(parent);
    }

    select.value = value ?? '';
    select.addEventListener('change', () => onChange(select.value || null));
    return select;
}

/**
 * Role dropdown. Roles Ovx can't give (managed, or above its own role) are shown but disabled.
 * @param {{ roles: any[], value: string | null, onChange: (id: string | null) => void, placeholder?: string, id?: string }} options
 */
export function roleSelect({ roles, value, onChange, placeholder = 'Choose a role', id }) {
    const select = el('select', { className: 'select', id });
    select.append(el('option', { value: '', textContent: placeholder, disabled: true }));
    for (const role of roles) {
        const reason = role.managed ? ' — managed by an integration' : !role.assignable ? ' — above Ovx’s role' : '';
        select.append(
            el('option', { value: role.id, textContent: `@${role.name}${reason}`, disabled: Boolean(reason) })
        );
    }
    select.value = value ?? '';
    select.addEventListener('change', () => onChange(select.value || null));
    return select;
}

/**
 * Whole-number input clamped to a range.
 * @param {{ value: number, min: number, max: number, onChange: (value: number) => void, suffix?: string, id?: string }} options
 */
export function numberInput({ value, min, max, onChange, suffix, id }) {
    const input = el('input', {
        className: 'input input-number',
        type: 'number',
        inputMode: 'numeric',
        min,
        max,
        step: 1,
        value,
        id,
    });
    input.addEventListener('input', () => {
        const number = Number(input.value);
        input.setCustomValidity(
            Number.isInteger(number) && number >= min && number <= max ? '' : `Between ${min} and ${max}`
        );
        if (input.validity.valid) onChange(number);
    });
    return suffix
        ? el('span', { className: 'input-suffix-wrap' }, [
              input,
              el('span', { className: 'input-suffix', textContent: suffix }),
          ])
        : input;
}

/**
 * Multi-line text with a character counter.
 * @param {{ value: string | null, maxLength: number, placeholder?: string, onChange: (value: string) => void, id?: string }} options
 */
export function textArea({ value, maxLength, placeholder, onChange, id }) {
    const area = el('textarea', {
        className: 'input textarea',
        value: value ?? '',
        maxLength,
        placeholder,
        rows: 3,
        id,
    });
    const counter = el('span', { className: 'counter' });
    const update = () => {
        counter.textContent = `${area.value.length}/${maxLength}`;
    };
    area.addEventListener('input', () => {
        update();
        onChange(area.value);
    });
    update();
    return el('div', { className: 'textarea-wrap' }, [area, counter]);
}

/**
 * A list of removable chips with a dropdown to add more (e.g. blacklisted roles or channels).
 * @param {{ options: { id: string, label: string }[], selected: string[], onChange: (ids: string[]) => void,
 *   placeholder: string, emptyText: string }} config
 */
export function chipPicker({ options, selected, onChange, placeholder, emptyText }) {
    const wrap = el('div', { className: 'chips-wrap' });
    let current = [...selected];

    const render = () => {
        const byId = new Map(options.map((option) => [option.id, option]));
        const chips = current.map((id) => {
            const remove = el(
                'button',
                { type: 'button', className: 'chip-remove', 'aria-label': `Remove ${byId.get(id)?.label ?? id}` },
                [staticSvg(ICONS.close)]
            );
            remove.addEventListener('click', () => {
                current = current.filter((value) => value !== id);
                onChange(current);
                render();
            });
            return el('span', { className: 'chip' }, [
                el('span', { textContent: byId.get(id)?.label ?? 'Deleted' }),
                remove,
            ]);
        });

        const add = el('select', { className: 'select select-small', 'aria-label': placeholder });
        add.append(el('option', { value: '', textContent: placeholder }));
        for (const option of options.filter((o) => !current.includes(o.id))) {
            add.append(el('option', { value: option.id, textContent: option.label }));
        }
        add.addEventListener('change', () => {
            if (!add.value) return;
            current = [...current, add.value];
            onChange(current);
            render();
        });

        wrap.replaceChildren(
            el(
                'div',
                { className: 'chips' },
                chips.length ? chips : [el('span', { className: 'chips-empty', textContent: emptyText })]
            ),
            add
        );
    };

    render();
    return wrap;
}

// ---------- Unsaved changes ----------

/** @type {(() => boolean) | null} */
let unsavedCheck = null;

/** Asks before leaving a page with unsaved changes. Returns true if it's OK to leave. */
export function confirmLeave() {
    if (!unsavedCheck?.()) return true;
    return window.confirm('You have unsaved changes. Leave without saving?');
}

window.addEventListener('beforeunload', (event) => {
    if (unsavedCheck?.()) event.preventDefault();
});

/**
 * Tracks a draft against the saved settings and shows a save bar while they differ.
 *
 * onReset is called whenever the draft is replaced by a new object: after the Reset button and after a
 * successful save. The page must re-render then, reading `state.draft` again, or its inputs would keep
 * editing the old draft and later changes would be lost. onSave should not re-render itself.
 *
 * @template T
 * @param {{ saved: T, onSave: (draft: T) => Promise<{ ok: boolean, saved?: T, errors?: string[] }>, onReset: () => void }} options
 */
export function createSettingsState({ saved, onSave, onReset }) {
    let savedValue = structuredClone(saved);
    let draft = structuredClone(saved);
    let saving = false;

    const message = el('span', { className: 'savebar-message', textContent: 'You have unsaved changes' });
    const errorList = el('ul', { className: 'savebar-errors' });
    const resetButton = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Reset' });
    const saveButton = el('button', {
        type: 'button',
        className: 'button button-primary',
        textContent: 'Save changes',
    });
    const bar = el('div', { className: 'savebar', hidden: true, role: 'region', 'aria-label': 'Unsaved changes' }, [
        el('div', { className: 'savebar-inner' }, [
            el('div', { className: 'savebar-text' }, [message, errorList]),
            el('div', { className: 'savebar-actions' }, [resetButton, saveButton]),
        ]),
    ]);

    const isDirty = () => JSON.stringify(draft) !== JSON.stringify(savedValue);
    const showErrors = (errors = []) => {
        errorList.replaceChildren(...errors.map((error) => el('li', { textContent: error })));
        bar.classList.toggle('savebar-has-errors', errors.length > 0);
    };
    const update = () => {
        bar.hidden = !isDirty() && !saving;
        if (!isDirty()) showErrors();
    };

    resetButton.addEventListener('click', () => {
        draft = structuredClone(savedValue);
        showErrors();
        update();
        onReset();
    });

    saveButton.addEventListener('click', async () => {
        if (saving) return;
        saving = true;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';
        let draftReplaced = false;
        try {
            const result = await onSave(structuredClone(draft));
            if (result.ok) {
                savedValue = structuredClone(result.saved ?? draft);
                draft = structuredClone(savedValue);
                draftReplaced = true;
                showErrors();
            } else {
                showErrors(result.errors ?? ['Could not save. Try again.']);
            }
        } finally {
            saving = false;
            saveButton.disabled = false;
            saveButton.textContent = 'Save changes';
            update();
        }
        // The page re-renders against the new draft object (see the note above)
        if (draftReplaced) onReset();
    });

    unsavedCheck = isDirty;

    return {
        bar,
        /** The current draft (mutate it, then call changed()) */
        get draft() {
            return draft;
        },
        get saved() {
            return savedValue;
        },
        /** Whether there are unsaved changes */
        get dirty() {
            return isDirty();
        },
        changed: update,
        /** Replace the saved settings (and drop any unsaved changes), e.g. after a reset */
        replaceSaved(value) {
            savedValue = structuredClone(value);
            draft = structuredClone(value);
            showErrors();
            update();
        },
        /** Stop guarding navigation (when the page is left) */
        dispose() {
            if (unsavedCheck === isDirty) unsavedCheck = null;
        },
    };
}

// ---------- Confirm and reset ----------

/**
 * Asks the user to confirm something that can't be undone.
 * @param {{ title: string, message: string, confirmLabel: string }} options
 * @returns {Promise<boolean>} true if they confirmed
 */
export function confirmDialog({ title, message, confirmLabel }) {
    const cancel = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Cancel' });
    const confirm = el('button', { type: 'button', className: 'button button-danger', textContent: confirmLabel });
    const titleId = nextId('confirm-title');
    const dialog = el('dialog', { className: 'dialog', 'aria-labelledby': titleId }, [
        el('div', { className: 'dialog-body' }, [
            el('h2', { className: 'dialog-title', id: titleId, textContent: title }),
            el('p', { className: 'dialog-text', textContent: message }),
            el('div', { className: 'dialog-actions' }, [cancel, confirm]),
        ]),
    ]);
    document.body.append(dialog);

    return new Promise((resolve) => {
        const close = (confirmed) => {
            dialog.close();
            dialog.remove();
            resolve(confirmed);
        };
        cancel.addEventListener('click', () => close(false));
        confirm.addEventListener('click', () => close(true));
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault(); // Escape key
            close(false);
        });
        dialog.showModal();
        cancel.focus(); // The safe choice is focused, so pressing Enter doesn't reset anything
    });
}

/**
 * A "Reset to defaults" card for the bottom of a settings page.
 * @param {{ description: string, confirmMessage: string, onReset: () => Promise<boolean> }} options
 *   onReset returns true if the reset worked
 */
export function resetCard({ description, confirmMessage, onReset }) {
    const button = el('button', { type: 'button', className: 'button button-danger-ghost', textContent: 'Reset…' });
    button.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
            title: 'Reset to defaults?',
            message: confirmMessage,
            confirmLabel: 'Reset',
        });
        if (!confirmed) return;
        button.disabled = true;
        button.textContent = 'Resetting…';
        try {
            await onReset();
        } finally {
            button.disabled = false;
            button.textContent = 'Reset…';
        }
    });

    return el('section', { className: 'card settings-card reset-card' }, [
        el('div', { className: 'reset-row' }, [
            el('div', {}, [
                el('h2', { className: 'card-title', textContent: 'Reset to defaults' }),
                el('p', { className: 'card-description', textContent: description }),
            ]),
            button,
        ]),
    ]);
}

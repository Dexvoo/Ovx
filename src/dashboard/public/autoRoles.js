// Auto Roles page: roles given automatically when people or bots join.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, chipPicker, createSettingsState, resetCard } from './forms.js';

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderAutoRoles(container, overview) {
    const { guild, roles, limits } = overview;

    const state = createSettingsState({
        saved: overview.autoRoles,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/auto-roles`, draft);
            if (status === 200) {
                overview.autoRoles = data;
                toast('Auto roles saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/auto-roles`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.autoRoles = data;
        state.replaceSaved(data);
        render();
        toast('Auto roles reset to defaults');
        return true;
    }

    /**
     * Roles Ovx can give, plus any already chosen that it no longer can (so they show up and can be removed).
     * @param {string[]} selected
     */
    function roleOptions(selected) {
        return roles
            .filter((role) => role.assignable || selected.includes(role.id))
            .map((role) => ({
                id: role.id,
                label: role.assignable ? `@${role.name}` : `@${role.name} (Ovx can't give this)`,
            }));
    }

    /**
     * @param {'humanRoleIds' | 'botRoleIds'} key
     */
    function rolePicker(key) {
        return chipPicker({
            options: roleOptions(state.draft[key]),
            selected: state.draft[key],
            placeholder: 'Add a role…',
            emptyText: 'No roles',
            onChange: (ids) => {
                state.draft[key] = ids;
                state.changed();
            },
        });
    }

    function render() {
        const draft = state.draft;
        const noGivableRoles = !roles.some((role) => role.assignable);

        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Auto Roles' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent: 'Give roles to people and bots automatically when they join.',
                }),
            ]),

            card('Auto roles', null, [
                !overview.botPermissions.manageRoles &&
                    el('p', {
                        className: 'notice',
                        textContent: 'Ovx needs the Manage Roles permission in this server to give roles.',
                    }),
                noGivableRoles &&
                    el('p', {
                        className: 'notice',
                        textContent:
                            'There are no roles below Ovx’s highest role. Move Ovx’s role higher in Server Settings → Roles.',
                    }),
                field({
                    label: 'Give roles on join',
                    description: 'Switch off to stop giving roles without losing the lists below.',
                    id: 'auto-roles-enabled',
                    control: toggle({
                        id: 'auto-roles-enabled',
                        label: 'Give roles on join',
                        checked: draft.enabled,
                        onChange: (enabled) => {
                            draft.enabled = enabled;
                            state.changed();
                        },
                    }),
                }),
            ]),

            card(
                'Roles for new members',
                'Given to people when they join. If your server uses Rules Screening, they get these once they accept the rules.',
                [
                    field({
                        label: 'Roles',
                        description: `Up to ${limits.AUTO_ROLES_MAX}. Only roles below Ovx’s highest role can be given.`,
                        stacked: true,
                        control: rolePicker('humanRoleIds'),
                    }),
                ]
            ),

            card('Roles for new bots', 'Given to bots when they’re added to the server.', [
                field({
                    label: 'Roles',
                    description: `Up to ${limits.AUTO_ROLES_MAX}.`,
                    stacked: true,
                    control: rolePicker('botRoleIds'),
                }),
            ]),

            resetCard({
                description: 'Switches auto roles off and clears both role lists.',
                confirmMessage:
                    'Auto roles will be switched off and both role lists cleared. Roles members already have are not removed. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );
        state.changed();
    }

    render();
    return () => state.dispose();
}

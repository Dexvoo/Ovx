// Commands page: turn commands off, or limit them to some channels or roles. Manage Server always bypasses this.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, chipPicker, createSettingsState, resetCard } from './forms.js';

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderCommands(container, overview) {
    const { guild, channels, roles, commands, commandCategories } = overview;
    const limits = overview.limits.COMMANDS;
    const channelOptions = channels
        .filter((channel) => channel.type === 'text')
        .map((channel) => ({ id: channel.id, label: `# ${channel.name}` }));
    const roleOptions = roles.map((role) => ({ id: role.id, label: `@${role.name}` }));
    /** Command names with their limits open, kept while re-rendering */
    const open = new Set();
    let search = '';

    const state = createSettingsState({
        saved: overview.commandSettings,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/commands`, draft);
            if (status === 200) {
                overview.commandSettings = data;
                toast('Command settings saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/commands`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.commandSettings = data;
        state.replaceSaved(data);
        render();
        toast('Every command is on again, with no limits');
        return true;
    }

    /** The command's limits in the draft, made when first needed. */
    const ruleFor = (name) => (state.draft.rules[name] ??= { channelIds: [], roleIds: [] });

    function commandRow(command) {
        const enabled = !state.draft.disabled.includes(command.name);
        const rule = state.draft.rules[command.name];
        const limited = Boolean(rule?.channelIds.length || rule?.roleIds.length);
        const label = command.menu ? `${command.name} (right-click menu)` : `/${command.name}`;

        const details = el('details', { className: 'type-details', open: open.has(command.name) }, [
            el('summary', { textContent: limited ? 'Limits (set)' : 'Limits' }),
            field({
                label: 'Only in these channels',
                description: 'Leave empty to allow everywhere. Threads count as their channel.',
                stacked: true,
                control: chipPicker({
                    options: channelOptions,
                    selected: rule?.channelIds ?? [],
                    placeholder: 'Add a channel…',
                    emptyText: 'Any channel',
                    onChange: (ids) => {
                        ruleFor(command.name).channelIds = ids.slice(0, limits.CHANNELS_MAX);
                        state.changed();
                    },
                }),
            }),
            field({
                label: 'Only for these roles',
                description: 'Leave empty so anyone can use it.',
                stacked: true,
                control: chipPicker({
                    options: roleOptions,
                    selected: rule?.roleIds ?? [],
                    placeholder: 'Add a role…',
                    emptyText: 'Anyone',
                    onChange: (ids) => {
                        ruleFor(command.name).roleIds = ids.slice(0, limits.ROLES_MAX);
                        state.changed();
                    },
                }),
            }),
        ]);
        details.addEventListener('toggle', () => (details.open ? open.add(command.name) : open.delete(command.name)));

        return el('div', { className: `type-card${enabled ? '' : ' command-off'}` }, [
            field({
                label,
                description: command.description ?? 'Right-click a message, then Apps.',
                id: `cmd-${command.name}`,
                control: toggle({
                    id: `cmd-${command.name}`,
                    label: `${label} on`,
                    checked: enabled,
                    onChange: (checked) => {
                        const disabled = state.draft.disabled.filter((name) => name !== command.name);
                        if (!checked) disabled.push(command.name);
                        state.draft.disabled = disabled;
                        state.changed();
                        render();
                    },
                }),
            }),
            enabled && details,
        ]);
    }

    const list = el('div');
    function renderList() {
        const query = search.trim().toLowerCase().replace(/^\//, '');
        const shown = commands.filter(
            (command) => !query || command.name.includes(query) || command.description?.toLowerCase().includes(query)
        );
        const groups = commandCategories
            .map((category) => ({ category, items: shown.filter((command) => command.category === category.id) }))
            .filter((group) => group.items.length > 0);
        list.replaceChildren(
            ...(groups.length === 0
                ? [el('p', { className: 'empty-note', textContent: 'No commands match.' })]
                : groups.map(({ category, items }) =>
                      card(`${category.emoji} ${category.name}`, null, [
                          el('div', { className: 'type-list' }, items.map(commandRow)),
                      ])
                  ))
        );
    }

    const searchBox = el('input', {
        className: 'search',
        type: 'search',
        placeholder: 'Search commands',
        'aria-label': 'Search commands',
    });
    searchBox.addEventListener('input', () => {
        search = searchBox.value;
        renderList();
    });

    function render() {
        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Commands' }),
                el('p', {
                    className: 'page-subtitle',
                    textContent:
                        'Turn commands off, or limit them to some channels or roles. Members with Manage Server can always use every command.',
                }),
            ]),
            el('p', {
                className: 'notice',
                textContent:
                    'Members still see limited commands, but get a message saying where they can use them. To hide a command from the list too, use Server Settings > Integrations > Ovx in Discord.',
            }),
            searchBox,
            list,
            resetCard({
                description: 'Turns every command back on and removes all limits.',
                confirmMessage: 'Every command will be turned on again and all limits removed. This cannot be undone.',
                onReset: resetToDefaults,
            }),
            state.bar
        );
        renderList();
        state.changed();
    }

    render();
    return () => state.dispose();
}

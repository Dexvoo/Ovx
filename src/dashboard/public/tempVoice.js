// Temp Voice page: "join to create" channels give each member their own voice channel.
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, numberInput, createSettingsState } from './forms.js';

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderTempVoice(container, overview) {
    const { guild, channels, categories } = overview;
    const limits = overview.limits.TEMP_VOICE;
    const voiceChannels = channels.filter((channel) => channel.type === 'voice');
    let settingUp = false;

    const state = createSettingsState({
        saved: overview.tempVoice,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/temp-voice`, draft);
            if (status === 200) {
                overview.tempVoice = data;
                toast('Join-to-create saved');
                return { ok: true, saved: data };
            }
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function setUp() {
        if (state.dirty) return toast('Save or reset your changes first', 'error');
        settingUp = true;
        render();
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/temp-voice/setup`, {});
        settingUp = false;
        if (status !== 200) {
            toast(data?.error ?? 'Could not set it up. Try again.', 'error');
            return render();
        }
        overview.tempVoice = data;
        state.replaceSaved(data);
        render();
        toast('Created “➕ Join to create”. Reload the page to see the new channels in the lists.');
    }

    function select(options, value, onChange, label, emptyLabel) {
        const element = el('select', { className: 'select', 'aria-label': label }, [
            ...(emptyLabel ? [el('option', { value: '', textContent: emptyLabel })] : []),
            ...options.map(([id, name]) => el('option', { value: id, textContent: name })),
        ]);
        element.value = value ?? '';
        element.addEventListener('change', () => onChange(element.value || null));
        return element;
    }

    function hubCard(hub, index) {
        const changed = () => state.changed();
        const remove = el('button', {
            type: 'button',
            className: 'button button-danger-ghost button-small',
            textContent: 'Remove',
        });
        remove.addEventListener('click', () => {
            state.draft.hubs.splice(index, 1);
            changed();
            render();
        });
        const template = el('input', {
            className: 'input input-wide',
            type: 'text',
            value: hub.nameTemplate,
            maxLength: limits.NAME_MAX,
            'aria-label': 'Channel name',
        });
        template.addEventListener('input', () => {
            hub.nameTemplate = template.value;
            changed();
        });

        return el('div', { className: 'type-card' }, [
            field({
                label: 'Join-to-create channel',
                description: 'Joining this voice channel makes a new one.',
                control: select(
                    voiceChannels.map((channel) => [channel.id, `🔊 ${channel.name}`]),
                    hub.channelId,
                    (id) => {
                        hub.channelId = id;
                        changed();
                    },
                    'Join-to-create channel',
                    'Choose a voice channel'
                ),
            }),
            field({
                label: 'Category',
                description: 'Where new channels go. Their permissions match the category’s.',
                control: select(
                    categories.map((category) => [category.id, category.name]),
                    hub.categoryId,
                    (id) => {
                        hub.categoryId = id;
                        changed();
                    },
                    'Category',
                    'Same as the join-to-create channel'
                ),
            }),
            field({
                label: 'Channel name',
                description: '{user} is their name, {username} their username.',
                control: template,
            }),
            field({
                label: 'User limit',
                description: 'How many people can join each new channel. 0 for no limit. Owners can change it.',
                control: numberInput({
                    value: hub.userLimit,
                    min: 0,
                    max: limits.USER_LIMIT_MAX,
                    onChange: (value) => {
                        hub.userLimit = value;
                        changed();
                    },
                }),
            }),
            el('div', { className: 'card-actions' }, [remove]),
        ]);
    }

    function render() {
        const { hubs } = state.draft;
        const add = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: '+ Use an existing voice channel',
            disabled: hubs.length >= limits.HUBS_MAX,
        });
        add.addEventListener('click', () => {
            hubs.push({ channelId: null, categoryId: null, nameTemplate: "{user}'s channel", userLimit: 0 });
            state.changed();
            render();
        });
        const quick = el('button', {
            type: 'button',
            className: 'button button-primary',
            textContent: settingUp ? 'Setting up…' : 'Set up for me',
            disabled: settingUp || hubs.length >= limits.HUBS_MAX,
        });
        quick.addEventListener('click', setUp);

        const missing = [
            !overview.botPermissions.moveMembers && 'Move Members',
            !overview.botPermissions.manageChannels && 'Manage Channels',
        ].filter(Boolean);

        container.replaceChildren(
            ...[
                el('div', { className: 'section-header' }, [
                    el('h1', { className: 'page-title', textContent: 'Join to Create' }),
                    el('p', {
                        className: 'page-subtitle',
                        textContent:
                            'Members join a “➕ Join to create” channel and get their own voice channel, with buttons to rename, lock or limit it. It’s deleted when everyone leaves.',
                    }),
                ]),
                missing.length > 0 &&
                    el('p', {
                        className: 'notice notice-warn',
                        textContent: `Ovx needs the ${missing.join(' and ')} permission${missing.length > 1 ? 's' : ''} for this. Give its role ${missing.length > 1 ? 'them' : 'it'} in Server Settings > Roles.`,
                    }),
                card('Join to create', null, [
                    field({
                        label: 'Join to create',
                        id: 'tv-enabled',
                        control: toggle({
                            id: 'tv-enabled',
                            label: 'Join to create',
                            checked: state.draft.enabled,
                            onChange: (checked) => {
                                state.draft.enabled = checked;
                                state.changed();
                            },
                        }),
                    }),
                    hubs.length === 0 &&
                        el('p', {
                            className: 'empty-note',
                            textContent:
                                '“Set up for me” makes a “Voice Channels” category with a “➕ Join to create” channel and turns this on.',
                        }),
                    el('div', { className: 'type-list' }, hubs.map(hubCard)),
                    el('div', { className: 'card-actions' }, [quick, add]),
                ]),
                state.bar,
            ].filter(Boolean)
        );
        state.changed();
    }

    render();
    return () => state.dispose();
}

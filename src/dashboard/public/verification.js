// Verification page: new members click Verify on a panel to get a role (optionally after typing a code).
import { el, apiSend, toast } from './ui.js';
import { card, field, toggle, channelSelect, numberInput, textArea, createSettingsState } from './forms.js';
import { markdown } from './markdown.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderVerification(container, overview) {
    const { guild, channels, roles } = overview;
    const limits = overview.limits.VERIFICATION;

    const state = createSettingsState({
        saved: overview.verification,
        onReset: () => render(),
        async onSave(draft) {
            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/verification`, draft);
            if (status !== 200)
                return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
            const { warning, ...saved } = data;
            overview.verification = saved;
            if (warning) toast(`Saved, but the panel wasn't posted: ${warning}`, 'error');
            else toast(saved.enabled ? 'Saved, and the panel is up to date' : 'Verification saved');
            return { ok: true, saved };
        },
    });

    /** A role dropdown; roles Ovx can't give are shown but disabled. */
    function roleChoice(value, onChange, emptyLabel, id) {
        const select = el('select', { className: 'select', id }, [
            el('option', { value: '', textContent: emptyLabel }),
            ...roles.map((role) => {
                const reason = role.managed
                    ? ' — managed by an integration'
                    : !role.assignable
                      ? ' — above Ovx’s role'
                      : '';
                return el('option', {
                    value: role.id,
                    textContent: `@${role.name}${reason}`,
                    disabled: Boolean(reason) && role.id !== value,
                });
            }),
        ]);
        select.value = value ?? '';
        select.addEventListener('change', () => onChange(select.value || null));
        return select;
    }

    const previewHost = el('div');
    function refreshPreview() {
        const draft = state.draft;
        const embed = el('div', { className: 'preview-embed' }, [
            el('div', { className: 'preview-embed-text' }, [
                el('div', { className: 'preview-embed-title', textContent: draft.title || 'Verify' }),
                el('div', {}, markdown(draft.description || '')),
            ]),
        ]);
        embed.style.borderLeftColor = overview.bot.embedColour ?? DEFAULT_COLOUR;
        previewHost.replaceChildren(
            el('div', { className: 'preview-message' }, [
                el('img', { className: 'preview-avatar', src: overview.bot.avatar, alt: '' }),
                el('div', { className: 'preview-content' }, [
                    el('div', { className: 'preview-author' }, [
                        el('span', {
                            className: 'preview-name',
                            textContent: overview.bot.nickname || overview.bot.username,
                        }),
                        el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
                    ]),
                    embed,
                    el('div', { className: 'preview-buttons' }, [
                        el('span', {
                            className: 'preview-button preview-button-success',
                            textContent: `✅ ${draft.buttonLabel || 'Verify'}`,
                        }),
                    ]),
                ]),
            ])
        );
    }

    function text(key, max, id) {
        const input = el('input', {
            className: 'input input-wide',
            type: 'text',
            id,
            value: state.draft[key],
            maxLength: max,
        });
        input.addEventListener('input', () => {
            state.draft[key] = input.value;
            refreshPreview();
            state.changed();
        });
        return input;
    }

    function render() {
        const draft = state.draft;
        const set = (key, value) => {
            draft[key] = value;
            state.changed();
        };
        const method = el(
            'select',
            { className: 'select', id: 'vf-method' },
            [
                ['button', 'Click the button'],
                ['code', 'Click, then type a short code'],
            ].map(([value, label]) => el('option', { value, textContent: label, selected: draft.method === value }))
        );
        method.addEventListener('change', () => set('method', method.value));

        container.replaceChildren(
            ...[
                el('div', { className: 'section-header' }, [
                    el('h1', { className: 'page-title', textContent: 'Verification' }),
                    el('p', {
                        className: 'page-subtitle',
                        textContent:
                            'New members click Verify to get a role that lets them see the rest of the server.',
                    }),
                ]),
                el('p', {
                    className: 'notice',
                    textContent:
                        'To make it work, let only the verified role see your channels (deny View Channel for @everyone on them), and keep the verify channel visible to @everyone.',
                }),
                card('Verification', 'Saving posts the panel, or updates it if it’s already posted.', [
                    field({
                        label: 'Verification',
                        id: 'vf-enabled',
                        control: toggle({
                            id: 'vf-enabled',
                            label: 'Verification',
                            checked: draft.enabled,
                            onChange: (checked) => set('enabled', checked),
                        }),
                    }),
                    field({
                        label: 'Channel',
                        description: 'Where the Verify panel is posted.',
                        id: 'vf-channel',
                        control: channelSelect({
                            channels,
                            value: draft.channelId,
                            noneLabel: 'Choose a channel',
                            id: 'vf-channel',
                            onChange: (id) => set('channelId', id),
                        }),
                    }),
                    field({
                        label: 'Verified role',
                        description: 'Given when they verify.',
                        id: 'vf-role',
                        control: roleChoice(draft.roleId, (id) => set('roleId', id), 'Choose a role', 'vf-role'),
                    }),
                    field({
                        label: 'Unverified role',
                        description: 'Optional: given when they join, taken away when they verify.',
                        id: 'vf-unverified',
                        control: roleChoice(
                            draft.unverifiedRoleId,
                            (id) => set('unverifiedRoleId', id),
                            'None',
                            'vf-unverified'
                        ),
                    }),
                    field({
                        label: 'How they verify',
                        description: 'A code stops simple bots that click buttons automatically.',
                        id: 'vf-method',
                        control: method,
                    }),
                    field({
                        label: 'Minimum account age',
                        description: 'Newer accounts are told when they can verify. 0 for no minimum.',
                        id: 'vf-age',
                        control: numberInput({
                            value: draft.minAccountDays,
                            min: 0,
                            max: limits.ACCOUNT_DAYS_MAX,
                            id: 'vf-age',
                            suffix: 'days',
                            onChange: (value) => set('minAccountDays', value),
                        }),
                    }),
                    field({
                        label: 'Remove if not verified',
                        description:
                            'Members who haven’t verified after this long are removed (and told they can rejoin). 0 to never remove.',
                        id: 'vf-kick',
                        control: numberInput({
                            value: draft.kickAfterHours,
                            min: 0,
                            max: limits.KICK_HOURS_MAX,
                            id: 'vf-kick',
                            suffix: 'hours',
                            onChange: (value) => set('kickAfterHours', value),
                        }),
                    }),
                ]),
                card('Panel', null, [
                    field({ label: 'Title', id: 'vf-title', control: text('title', limits.TITLE_MAX, 'vf-title') }),
                    field({
                        label: 'Text',
                        stacked: true,
                        control: textArea({
                            value: draft.description,
                            maxLength: limits.DESCRIPTION_MAX,
                            onChange: (value) => {
                                draft.description = value;
                                refreshPreview();
                                state.changed();
                            },
                        }),
                    }),
                    field({
                        label: 'Button',
                        id: 'vf-button',
                        control: text('buttonLabel', limits.BUTTON_MAX, 'vf-button'),
                    }),
                    previewHost,
                ]),
                state.bar,
            ].filter(Boolean)
        );
        refreshPreview();
        state.changed();
    }

    render();
    return () => state.dispose();
}

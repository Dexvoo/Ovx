// Bot Settings page: how Ovx appears in this server (profile and embed colour).
import { el, apiSend, toast } from './ui.js';
import { card, field, textArea, createSettingsState, resetCard } from './forms.js';

const DEFAULT_COLOUR = '#71368a'; // Matches DEFAULT_EMBED_COLOUR in shared/cache/guildSettings.cache.js
const ACCEPTED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// Uploads are cropped and shrunk to these sizes in the browser before sending (GIFs are sent as they are)
const AVATAR_SIZE = { width: 512, height: 512, type: 'image/png' };
const BANNER_SIZE = { width: 1200, height: 480, type: 'image/jpeg' };

/**
 * @param {HTMLElement} container
 * @param {any} overview - From GET /api/guilds/:id
 * @returns {() => void} Cleanup when leaving the page
 */
export function renderBotSettings(container, overview) {
    const { guild, limits } = overview;

    /** The editable parts; avatar/banner are only present once a new image is chosen or one is removed */
    const editable = (bot) => ({ nickname: bot.nickname ?? '', bio: bot.bio ?? '', embedColour: bot.embedColour });

    const state = createSettingsState({
        saved: editable(overview.bot),
        onReset: () => render(),
        async onSave(draft) {
            const body = {
                nickname: draft.nickname.trim() || null,
                bio: draft.bio.trim() || null,
                embedColour: draft.embedColour,
            };
            if (draft.avatar !== undefined) body.avatar = draft.avatar;
            if (draft.banner !== undefined) body.banner = draft.banner;

            const { status, data } = await apiSend('PUT', `/api/guilds/${guild.id}/bot`, body);
            if (status === 200) {
                overview.bot = data;
                toast('Bot settings saved');
                return { ok: true, saved: editable(data) };
            }
            if (status === 413) return { ok: false, errors: ['The images are too large. Try smaller ones.'] };
            return { ok: false, errors: data?.details ?? [data?.error ?? 'Could not save. Try again.'] };
        },
    });

    async function resetToDefaults() {
        const { status, data } = await apiSend('POST', `/api/guilds/${guild.id}/reset/bot`, {});
        if (status !== 200) {
            toast(data?.error ?? 'Could not reset. Try again.', 'error');
            return false;
        }
        overview.bot = data;
        state.replaceSaved(editable(data));
        render();
        toast('Bot settings reset to defaults');
        return true;
    }

    function render() {
        const { bot } = overview;
        const draft = state.draft;

        // What the profile will look like with the unsaved changes
        const shownAvatar = () =>
            draft.avatar === undefined ? bot.avatar : draft.avatar === null ? bot.defaultAvatar : draft.avatar;
        const shownBanner = () => (draft.banner === undefined ? bot.banner : draft.banner);
        const hasCustomAvatar = () => (draft.avatar === undefined ? Boolean(bot.customAvatar) : Boolean(draft.avatar));
        const shownName = () => draft.nickname.trim() || bot.username;

        const bannerEl = el('div', { className: 'profile-banner' });
        const avatarEl = el('img', { className: 'profile-avatar', alt: '', width: 80, height: 80 });
        const nameEl = el('span', { className: 'profile-name' });
        const bioEl = el('p', { className: 'profile-bio' });
        const updatePreview = () => {
            const banner = shownBanner();
            bannerEl.replaceChildren(banner ? el('img', { src: banner, alt: '' }) : '');
            bannerEl.classList.toggle('profile-banner-empty', !banner);
            avatarEl.src = shownAvatar();
            nameEl.textContent = shownName();
            bioEl.textContent = draft.bio.trim();
            bioEl.hidden = !draft.bio.trim();
        };

        const change = () => {
            updatePreview();
            state.changed();
            updateImageButtons();
        };

        const preview = el('div', { className: 'profile-card', 'aria-label': 'Preview' }, [
            bannerEl,
            el('div', { className: 'profile-content' }, [
                avatarEl,
                el('div', { className: 'profile-line' }, [
                    nameEl,
                    el('span', { className: 'bot-preview-tag', textContent: 'APP' }),
                ]),
                el('div', { className: 'bot-preview-username', textContent: bot.username }),
                bioEl,
            ]),
        ]);

        // ---- Nickname ----
        const counter = el('span', { className: 'input-counter' });
        const nicknameInput = el('input', {
            className: 'input input-wide',
            id: 'bot-nickname',
            type: 'text',
            value: draft.nickname,
            placeholder: bot.username,
            maxLength: limits.NICKNAME_MAX * 2, // Emojis take 2 here; the counter counts them as 1
            autocomplete: 'off',
            spellcheck: false,
            disabled: !bot.canChangeNickname,
        });
        const updateCounter = () => {
            const length = [...nicknameInput.value.trim()].length;
            counter.textContent = `${length}/${limits.NICKNAME_MAX}`;
            counter.classList.toggle('input-counter-over', length > limits.NICKNAME_MAX);
        };
        nicknameInput.addEventListener('input', () => {
            draft.nickname = nicknameInput.value;
            updateCounter();
            change();
        });
        updateCounter();

        const nicknameDefault = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: 'Use default',
            disabled: !bot.canChangeNickname,
        });
        nicknameDefault.addEventListener('click', () => {
            nicknameInput.value = '';
            nicknameInput.dispatchEvent(new Event('input'));
            nicknameInput.focus();
        });

        // ---- Avatar and banner ----
        const avatarPicker = imagePicker({
            label: 'avatar',
            size: AVATAR_SIZE,
            maxBytes: limits.IMAGE_MAX_BYTES,
            onPick: (dataUrl) => {
                draft.avatar = dataUrl;
                change();
            },
            onRemove: () => {
                // Removing an image that was only chosen (not saved yet) just undoes the choice
                if (draft.avatar && !bot.customAvatar) delete draft.avatar;
                else draft.avatar = null;
                change();
            },
        });
        const bannerPicker = imagePicker({
            label: 'banner',
            size: BANNER_SIZE,
            maxBytes: limits.IMAGE_MAX_BYTES,
            onPick: (dataUrl) => {
                draft.banner = dataUrl;
                change();
            },
            onRemove: () => {
                if (draft.banner && !bot.banner) delete draft.banner;
                else draft.banner = null;
                change();
            },
        });
        const updateImageButtons = () => {
            avatarPicker.setRemovable(hasCustomAvatar());
            bannerPicker.setRemovable(Boolean(shownBanner()));
        };

        // ---- About Me ----
        const bio = textArea({
            id: 'bot-bio',
            value: draft.bio,
            maxLength: limits.BIO_MAX,
            placeholder: 'Tell members what Ovx does here…',
            onChange: (value) => {
                draft.bio = value;
                change();
            },
        });

        // ---- Embed colour ----
        const colourValue = () => draft.embedColour ?? DEFAULT_COLOUR;
        const embedPreview = el('div', { className: 'embed-preview' }, [
            el('div', { className: 'embed-preview-title', textContent: 'Maximum Level Edited' }),
            el('div', { className: 'embed-preview-field' }, [
                el('strong', { textContent: 'Old' }),
                el('span', { textContent: '100' }),
            ]),
            el('div', { className: 'embed-preview-field' }, [
                el('strong', { textContent: 'New' }),
                el('span', { textContent: '75' }),
            ]),
        ]);
        const colourPicker = el('input', {
            type: 'color',
            className: 'colour-input',
            id: 'bot-embed-colour',
            value: colourValue(),
        });
        const colourText = el('span', { className: 'colour-value' });
        const colourDefault = el('button', {
            type: 'button',
            className: 'button button-ghost',
            textContent: 'Use default',
        });
        const updateColour = () => {
            embedPreview.style.borderLeftColor = colourValue();
            colourText.textContent = draft.embedColour ? colourValue() : `${DEFAULT_COLOUR} (default)`;
            colourDefault.disabled = draft.embedColour === null;
        };
        colourPicker.addEventListener('input', () => {
            draft.embedColour = colourPicker.value.toLowerCase();
            updateColour();
            state.changed();
        });
        colourDefault.addEventListener('click', () => {
            draft.embedColour = null;
            colourPicker.value = DEFAULT_COLOUR;
            updateColour();
            state.changed();
        });
        updateColour();

        container.replaceChildren(
            el('div', { className: 'section-header' }, [
                el('h1', { className: 'page-title', textContent: 'Bot Settings' }),
                el('p', { className: 'page-subtitle', textContent: `How Ovx appears in ${guild.name}.` }),
            ]),

            card('Profile', 'Only changes how Ovx looks in this server. Other servers are not affected.', [
                preview,
                !bot.canChangeNickname &&
                    el('p', {
                        className: 'notice',
                        textContent:
                            'Ovx needs the Change Nickname permission in this server before its nickname can be changed.',
                    }),
                field({
                    label: 'Nickname',
                    description: `Leave empty to use ${bot.username}. Shown in the member list and next to messages.`,
                    id: 'bot-nickname',
                    stacked: true,
                    control: el('div', { className: 'input-row' }, [
                        el('div', { className: 'input-counter-wrap' }, [nicknameInput, counter]),
                        nicknameDefault,
                    ]),
                }),
                field({
                    label: 'Avatar',
                    description: 'Square images work best. Animated GIFs are kept animated.',
                    control: avatarPicker.element,
                }),
                field({
                    label: 'Banner',
                    description: 'Shown at the top of Ovx’s profile. Wide images (5:2) work best.',
                    control: bannerPicker.element,
                }),
                field({
                    label: 'About Me',
                    description: 'Shown on Ovx’s profile in this server.',
                    id: 'bot-bio',
                    stacked: true,
                    control: bio,
                }),
            ]),

            card(
                'Embed colour',
                'The colour down the side of Ovx’s messages, like command replies and rank cards. Log messages keep their own colours.',
                [
                    el('div', { className: 'colour-row' }, [
                        el('label', { className: 'colour-picker', for: 'bot-embed-colour' }, [
                            colourPicker,
                            colourText,
                        ]),
                        colourDefault,
                    ]),
                    embedPreview,
                ]
            ),

            resetCard({
                description: 'Puts Ovx’s nickname, avatar, banner, About Me and embed colour back to the defaults.',
                confirmMessage:
                    'Ovx’s nickname, avatar, banner and About Me in this server will be removed, and its embed colour goes back to the default. This cannot be undone.',
                onReset: resetToDefaults,
            }),

            state.bar
        );

        updatePreview();
        updateImageButtons();
        state.changed();
    }

    render();
    return () => state.dispose();
}

/**
 * Upload and remove buttons for an image. Images are cropped to fill the size and shrunk in the browser,
 * so uploads stay small; animated GIFs are sent as they are (cropping would stop the animation).
 * @param {{ label: string, size: { width: number, height: number, type: string }, maxBytes: number,
 *   onPick: (dataUrl: string) => void, onRemove: () => void }} options
 */
function imagePicker({ label, size, maxBytes, onPick, onRemove }) {
    const file = el('input', { type: 'file', accept: ACCEPTED_IMAGES.join(','), hidden: true });
    const upload = el('button', { type: 'button', className: 'button button-ghost', textContent: `Upload ${label}` });
    const remove = el('button', { type: 'button', className: 'button button-ghost', textContent: 'Remove' });

    upload.addEventListener('click', () => file.click());
    remove.addEventListener('click', onRemove);
    file.addEventListener('change', async () => {
        const chosen = file.files?.[0];
        file.value = ''; // Choosing the same file again still triggers a change
        if (!chosen) return;
        upload.disabled = true;
        try {
            onPick(await prepareImage(chosen, size, maxBytes));
        } catch (error) {
            toast(error.message, 'error');
        } finally {
            upload.disabled = false;
        }
    });

    return {
        element: el('div', { className: 'image-buttons' }, [upload, remove, file]),
        /** @param {boolean} removable */
        setRemovable(removable) {
            remove.hidden = !removable;
        },
    };
}

/**
 * @param {File} file
 * @param {{ width: number, height: number, type: string }} size
 * @param {number} maxBytes
 * @returns {Promise<string>} A data URL
 */
async function prepareImage(file, size, maxBytes) {
    const megabytes = `${maxBytes / 1024 / 1024} MB`;
    if (!ACCEPTED_IMAGES.includes(file.type)) throw new Error('Choose a PNG, JPEG, GIF or WebP image.');

    if (file.type === 'image/gif') {
        if (file.size > maxBytes) throw new Error(`Animated GIFs must be ${megabytes} or smaller.`);
        return readAsDataUrl(file);
    }

    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error('That image could not be opened. Try a different one.');
    }

    // Crop to fill the size (like Discord does), keeping the centre
    const scale = Math.max(size.width / bitmap.width, size.height / bitmap.height);
    const width = Math.min(size.width, Math.round(bitmap.width * scale));
    const height = Math.min(size.height, Math.round(bitmap.height * scale));
    const canvas = el('canvas', { width: size.width, height: size.height });
    const context = canvas.getContext('2d');
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    context.drawImage(
        bitmap,
        (bitmap.width - sourceWidth) / 2,
        (bitmap.height - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0,
        0,
        size.width,
        size.height
    );
    bitmap.close();

    let blob = await new Promise((resolve) => canvas.toBlob(resolve, size.type, 0.9));
    if (blob && blob.size > maxBytes) blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob || blob.size > maxBytes) throw new Error(`That image is too large even after shrinking it.`);
    return readAsDataUrl(blob);
}

/** @param {Blob} blob @returns {Promise<string>} */
function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.onerror = () => reject(new Error('That image could not be read.'));
        reader.readAsDataURL(blob);
    });
}

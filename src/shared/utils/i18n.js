import { ENV } from '../../bootstrap/environment.js';
import en_GB from '../../locales/en-GB.js';
import es_ES from '../../locales/es-ES.js';
import fr from '../../locales/fr.js';
import de from '../../locales/de.js';
// import id from '../../locales/id.js';
// import da from '../../locales/da.js';
// import es_419 from '../../locales/es-419.js';
// import hr from '../../locales/hr.js';
// import it from '../../locales/it.js';
// import lt from '../../locales/lt.js';
// import hu from '../../locales/hu.js';
// import nl from '../../locales/nl.js';
// import no from '../../locales/no.js';
// import pl from '../../locales/pl.js';
// import pt_BR from '../../locales/pt-BR.js';
// import ro from '../../locales/ro.js';
// import fi from '../../locales/fi.js';
// import sv_SE from '../../locales/sv-SE.js';
// import vi from '../../locales/vi.js';
// import tr from '../../locales/tr.js';
// import cs from '../../locales/cs.js';
// import el from '../../locales/el.js';
// import bg from '../../locales/bg.js';
// import ru from '../../locales/ru.js';
// import uk from '../../locales/uk.js';
// import hi from '../../locales/hi.js';
// import th from '../../locales/th.js';
// import zh_CN from '../../locales/zh-CN.js';
// import ja from '../../locales/ja.js';
// import zh_TW from '../../locales/zh-TW.js';
// import ko from '../../locales/ko.js';

const locales = {
    'en-GB': en_GB,
    'en-US': en_GB,
    'es-ES': es_ES,
    fr: fr,
    de: de,
    // 'id': id,
    // 'es-419': es_419,
    // 'hr': hr,
    // 'it': it,
    // 'lt': lt,
    // 'hu': hu,
    // 'nl': nl,
    // 'no': no,
    // 'pl': pl,
    // 'pt-BR': pt_BR,
    // 'ro': ro,
    // 'fi': fi,
    // 'sv-SE': sv_SE,
    // 'vi': vi,
    // 'tr': tr,
    // 'cs': cs,
    // 'el': el,
    // 'bg': bg,
    // 'ru': ru,
    // 'uk': uk,
    // 'hi': hi,
    // 'th': th,
    // 'zh-CN': zh_CN,
    // 'ja': ja,
    // 'zh-TW': zh_TW,
    // 'ko': ko,
};

const defaultLocale = ENV.DEFAULT_LANGUAGE;

/**
 * Translates a key into the requested locale string.
 *
 * @param {string} key - The dot-notated key (e.g., 'ping.latency')
 * @param {import('discord.js').Locale | string} [locale] - The interaction.locale from Discord, or a default language code
 * @param {object}[args={}] - Variables to replace in the string (e.g., { ms: 120 })
 * @returns {string} The translated string
 */
function Translate(key, locale = defaultLocale, args = {}) {
    const lang = locales[locale] || locales[defaultLocale];

    const keys = key.split('.');
    let text = lang;

    for (const k of keys) {
        text = text?.[k];
    }

    if (text === undefined && locale !== defaultLocale) {
        return Translate(key, defaultLocale, args);
    }

    if (text === undefined) {
        return key;
    }

    for (const [k, v] of Object.entries(args)) {
        // Replacer function so values containing $&, $1 etc. are inserted literally
        text = text.replaceAll(`{${k}}`, () => String(v));
    }

    return text;
}

export { Translate };

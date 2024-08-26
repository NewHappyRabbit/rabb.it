// replace cyrillic characters with latin
const alphabet = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "u", "ь": "y", "ю": "yu", "я": "ya" };

export function transliterate(word) {
    return word.split('').map(function (char) {
        return alphabet[char] || char;
    }).join("");
}

export function slugify(word) {
    return transliterate(word.toLowerCase().replace(/ /g, '-'))
}
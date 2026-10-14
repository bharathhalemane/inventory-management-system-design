const escapeRegex = (text) => {
    return text.replace(/[.*+?^${}()|[\}\\]/g, '\\$&');
}

module.exports = escapeRegex;
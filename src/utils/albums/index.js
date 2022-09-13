/* eslint-disable camelcase */
const mapDBToModelAlbums = ({
    id,
    name,
    year,
    songs,
}) => ({
    id,
    name,
    year,
    songs,
});

module.exports = { mapDBToModelAlbums };
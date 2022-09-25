/* eslint-disable camelcase */
const mapDBToModelAlbums = ({
  id,
  name,
  year,
  cover,
  songs,
}) => ({
  id,
  name,
  year,
  coverUrl: cover,
  songs,
});

module.exports = { mapDBToModelAlbums };

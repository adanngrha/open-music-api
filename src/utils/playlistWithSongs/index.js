/* eslint-disable camelcase */
const mapDBToModelPlaylistWithSongs = ({
  id,
  name,
  username,
  songs,
}) => ({
  id,
  name,
  username,
  songs,
});

module.exports = { mapDBToModelPlaylistWithSongs };

/* eslint-disable camelcase */
const mapDBToModelPlaylists = ({
  id,
  name,
  username,
  created_at,
  updated_at,
}) => ({
  id,
  name,
  username,
  createdAt: created_at,
  updatedAt: updated_at,
});

module.exports = { mapDBToModelPlaylists };

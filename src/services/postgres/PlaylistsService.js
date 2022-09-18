const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const { mapDBToModelPlaylists } = require('../../utils/playlists');
const { mapDBToModelPlaylistWithSongs } = require('../../utils/playlistWithSongs');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor() {
    this._pool = new Pool();
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;
    const createdAt = new Date().toISOString();

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3, $4, $4) RETURNING id',
      values: [id, name, owner, createdAt],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Playlist gagal ditambahkan!');
    }

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    const query = {
      text: `SELECT playlists.id, playlists.name, users.username 
      FROM playlists
      LEFT JOIN users ON playlists.owner = users.id
      WHERE playlists.owner = $1
      GROUP BY playlists.id, users.username`,
      values: [owner],
    };
    const result = await this._pool.query(query);
    return result.rows.map(mapDBToModelPlaylists);
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }
  }

  async addSongToPlaylistById(playlistId, { songId }) {
    const checkSongQuery = {
      text: 'SELECT * FROM songs WHERE id = $1',
      values: [songId],
    };

    const checkResult = await this._pool.query(checkSongQuery);

    if (!checkResult.rowCount) {
      throw new NotFoundError('Gagal menambahkan lagu ke playlist. Lagu yang ingin ditambahkan tidak ditemukan!');
    }

    const id = nanoid(16);
    const query = {
      text: 'INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Lagu gagal ditambahkan ke playlist!');
    }

    return result.rows[0].id;
  }

  async getSongsFromPlaylistById(playlistId) {
    const playlistQuery = {
      text: `SELECT playlists.id, playlists.name, users.username  
      FROM playlists 
      JOIN users ON playlists.owner = users.id
      WHERE playlists.id = $1
      GROUP BY playlists.id, users.username`,
      values: [playlistId],
    };

    const songsQuery = {
      text: `SELECT songs.id, songs.title, songs.performer 
      FROM playlist_songs
      JOIN songs ON playlist_songs.song_id = songs.id
      WHERE playlist_songs.playlist_id = $1
      GROUP BY songs.id`,
      values: [playlistId],
    };

    const playlistResult = await this._pool.query(playlistQuery);
    const songsResult = await this._pool.query(songsQuery);

    if (!playlistResult.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    playlistResult.rows[0].songs = songsResult.rows;

    return playlistResult.rows.map(mapDBToModelPlaylistWithSongs)[0];
  }

  async deleteSongFromPlaylistById(playlistId, { songId }) {
    const query = {
      text: 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Lagu gagal dihapus dari playlist. Playlist atau lagu tidak ditemukan');
    }
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const playlist = result.rows[0];

    if (playlist.owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;

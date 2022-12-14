const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const { mapDBToModelPlaylists } = require('../../utils/playlists');
const { mapDBToModelPlaylistWithSongs } = require('../../utils/playlistWithSongs');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationService) {
    this._pool = new Pool();
    this._collaborationService = collaborationService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
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
      LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id 
      LEFT JOIN users ON playlists.owner = users.id 
      WHERE playlists.owner = $1 
      OR collaborations.user_id = $1`,
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

  async getPlaylistActivities(playlistId) {
    await this.checkPlaylist(playlistId);

    const query = {
      text: `SELECT users.username, songs.title, playlist_song_activities.action, playlist_song_activities.time
      FROM playlist_song_activities 
      JOIN users ON playlist_song_activities.user_id = users.id
      JOIN songs ON playlist_song_activities.song_id = songs.id
      WHERE playlist_song_activities.playlist_id = $1`,
      values: [playlistId],
    };

    const activitiesResult = await this._pool.query(query);

    if (!activitiesResult.rowCount) {
      throw new NotFoundError('Playlist tidak tidak memiliki aktivitas!');
    }

    return activitiesResult.rows;
  }

  async addActivity(playlistId, songId, credentialId, action) {
    // menambahkan aktivitas ke playlist_song_activities
    const id = nanoid(16);
    const time = new Date().toISOString();

    const query = {
      text: 'INSERT INTO playlist_song_activities VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, playlistId, songId, credentialId, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Aktivitas gagal ditambahkan!');
    }
  }

  async checkPlaylist(playlistId) {
    const checkPlaylist = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [playlistId],
    };

    const checkPlaylistResult = await this._pool.query(checkPlaylist);

    if (!checkPlaylistResult.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan!');
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
      }
      try {
        await this._collaborationService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;

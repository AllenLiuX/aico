import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Container, Typography, Box, Paper, Tabs, Tab, 
  Button, CircularProgress, Alert, Grid, Card, 
  CardContent, CardHeader, List, ListItem, ListItemText,
  Divider, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, TableSortLabel
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/AdminDashboard.css';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdminDashboard = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [songInteractions, setSongInteractions] = useState([]);
  const [roomInteractions, setRoomInteractions] = useState([]);
  const [songFeatures, setSongFeatures] = useState([]);
  const [roomFeatures, setRoomFeatures] = useState([]);
  const [stats, setStats] = useState({
    totalSongs: 0,
    totalRooms: 0,
    totalInteractions: 0,
    uniqueUsers: 0
  });
  
  // Sorting state
  const [songInteractionsOrder, setSongInteractionsOrder] = useState({
    orderBy: 'timestamp',
    order: 'desc'
  });
  
  const [roomInteractionsOrder, setRoomInteractionsOrder] = useState({
    orderBy: 'timestamp',
    order: 'desc'
  });
  
  const [songFeaturesOrder, setSongFeaturesOrder] = useState({
    orderBy: 'play_count',
    order: 'desc'
  });
  
  const [roomFeaturesOrder, setRoomFeaturesOrder] = useState({
    orderBy: 'join_count',
    order: 'desc'
  });

  useEffect(() => {
    // Check if user is admin, if not redirect to home
    if (user && !user.is_admin) {
      console.log('Non-admin user attempting to access admin dashboard:', user);
      navigate('/');
      return;
    }
    
    // Load initial data if user is admin
    if (user && user.is_admin) {
      fetchSongFeatures();
      fetchRoomFeatures();
    }
  }, [user, navigate]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    
    // Load data based on selected tab
    if (newValue === 0 && songFeatures.length === 0) {
      fetchSongFeatures();
    } else if (newValue === 1 && roomFeatures.length === 0) {
      fetchRoomFeatures();
    } else if (newValue === 2 && songInteractions.length === 0) {
      fetchSongInteractions();
    } else if (newValue === 3 && roomInteractions.length === 0) {
      fetchRoomInteractions();
    }
  };

  const fetchSongInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user-activity/export/song-interactions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSongInteractions(response.data.data);
      } else {
        setError("Failed to load song interactions");
      }
    } catch (err) {
      setError(err.message || "Failed to load song interactions");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomInteractions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user-activity/export/room-interactions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setRoomInteractions(response.data.data);
      } else {
        setError("Failed to load room interactions");
      }
    } catch (err) {
      setError(err.message || "Failed to load room interactions");
    } finally {
      setLoading(false);
    }
  };

  const fetchSongFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      console.log('Fetching song features with token:', token ? `${token.substring(0, 10)}...` : 'No token');
      
      const response = await axios.get('/api/user-activity/export/song-features', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Song features response:', response.data);
      
      if (response.data.success) {
        const features = response.data.data || [];
        console.log(`Received ${features.length} song features`);
        setSongFeatures(features);
        
        // Update stats
        const totalInteractions = Array.isArray(features) ? features.reduce((sum, song) => {
          const songInteractions = (song.play_count || 0) + (song.favorite_count || 0) + 
                                   (song.add_count || 0) + (song.remove_count || 0);
          console.log(`Song ${song.title || song.song_id}: ${songInteractions} interactions`);
          return sum + songInteractions;
        }, 0) : 0;
        
        console.log(`Total songs: ${features.length}, Total interactions: ${totalInteractions}`);
        
        setStats(prev => ({
          ...prev,
          totalSongs: features.length,
          totalInteractions: totalInteractions
        }));
      } else {
        console.error("Failed to load song features:", response.data.error || "Unknown error");
        setError("Failed to load song features");
      }
    } catch (err) {
      console.error('Error fetching song features:', err);
      setError(err.message || "Failed to load song features");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      console.log('Fetching room features with token:', token ? `${token.substring(0, 10)}...` : 'No token');
      
      const response = await axios.get('/api/user-activity/export/room-features', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Room features response:', response.data);
      
      if (response.data.success) {
        const features = response.data.data || [];
        console.log(`Received ${features.length} room features`);
        setRoomFeatures(features);
        
        // Get unique users
        const uniqueUsersList = Array.isArray(features) 
          ? [...new Set(features.filter(room => room.users && room.users.length > 0)
              .flatMap(room => room.users))]
          : [];
        
        console.log(`Total rooms: ${features.length}, Unique users: ${uniqueUsersList.length}`);
        
        // Update stats
        setStats(prev => ({
          ...prev,
          totalRooms: features.length,
          uniqueUsers: uniqueUsersList.length
        }));
      } else {
        console.error("Failed to load room features:", response.data.error || "Unknown error");
        setError("Failed to load room features");
      }
    } catch (err) {
      console.error('Error fetching room features:', err);
      setError(err.message || "Failed to load room features");
    } finally {
      setLoading(false);
    }
  };

  const downloadDataset = async (format = 'json') => {
    try {
      setLoading(true);
      setError(null);
      
      // Create a download link
      const link = document.createElement('a');
      link.href = `/api/user-activity/export/dataset?format=${format}&download=true`;
      link.setAttribute('download', `recommendation_data.zip`);
      
      // Use fetch with credentials
      fetch(link.href, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        setError(err.message || "Failed to download dataset");
      })
      .finally(() => {
        setLoading(false);
      });
    } catch (err) {
      setError(err.message || "Failed to download dataset");
      setLoading(false);
    }
  };

  // Sorting functions
  const handleSortRequest = (table, property) => {
    const isAsc = table.orderBy === property && table.order === 'asc';
    
    switch(table.name) {
      case 'songInteractions':
        setSongInteractionsOrder({
          orderBy: property,
          order: isAsc ? 'desc' : 'asc'
        });
        break;
      case 'roomInteractions':
        setRoomInteractionsOrder({
          orderBy: property,
          order: isAsc ? 'desc' : 'asc'
        });
        break;
      case 'songFeatures':
        setSongFeaturesOrder({
          orderBy: property,
          order: isAsc ? 'desc' : 'asc'
        });
        break;
      case 'roomFeatures':
        setRoomFeaturesOrder({
          orderBy: property,
          order: isAsc ? 'desc' : 'asc'
        });
        break;
      default:
        break;
    }
  };

  // Sort function for any array based on property and order
  const getSortedData = (data, orderBy, order) => {
    return [...data].sort((a, b) => {
      // Handle numeric values
      if (typeof a[orderBy] === 'number' && typeof b[orderBy] === 'number') {
        return order === 'asc' 
          ? a[orderBy] - b[orderBy] 
          : b[orderBy] - a[orderBy];
      }
      
      // Handle string values
      if (a[orderBy] && b[orderBy]) {
        return order === 'asc'
          ? a[orderBy].localeCompare(b[orderBy])
          : b[orderBy].localeCompare(a[orderBy]);
      }
      
      // Handle null/undefined values
      if (!a[orderBy] && b[orderBy]) return order === 'asc' ? -1 : 1;
      if (a[orderBy] && !b[orderBy]) return order === 'asc' ? 1 : -1;
      
      return 0;
    });
  };

  // Get sorted data for each table
  const sortedSongInteractions = getSortedData(
    songInteractions, 
    songInteractionsOrder.orderBy, 
    songInteractionsOrder.order
  );

  const sortedRoomInteractions = getSortedData(
    roomInteractions, 
    roomInteractionsOrder.orderBy, 
    roomInteractionsOrder.order
  );

  const sortedSongFeatures = getSortedData(
    songFeatures, 
    songFeaturesOrder.orderBy, 
    songFeaturesOrder.order
  );

  const sortedRoomFeatures = getSortedData(
    roomFeatures, 
    roomFeaturesOrder.orderBy, 
    roomFeaturesOrder.order
  );

  // Prepare chart data
  const topSongsData = Array.isArray(sortedSongFeatures) && sortedSongFeatures.length > 0 
    ? [...sortedSongFeatures]
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 10)
      .map(song => ({
        name: song.title && song.title.length > 20 ? song.title.substring(0, 20) + '...' : (song.title || 'Unknown'),
        plays: song.play_count || 0,
        favorites: song.favorite_count || 0,
        adds: song.add_count || 0
      }))
    : [];

  const topRoomsData = Array.isArray(sortedRoomFeatures) && sortedRoomFeatures.length > 0
    ? [...sortedRoomFeatures]
      .sort((a, b) => (b.join_count || 0) - (a.join_count || 0))
      .slice(0, 10)
      .map(room => ({
        name: room.room_id && room.room_id.length > 20 ? room.room_id.substring(0, 20) + '...' : (room.room_id || 'Unknown'),
        joins: room.join_count || 0,
        favorites: room.favorite_count || 0,
        users: room.user_count || 0
      }))
    : [];

  // If not admin, show access denied
  if (!user || !user.is_admin) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          You don't have permission to access this page. Admin access required.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Dashboard - User Activity Analysis
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Songs
              </Typography>
              <Typography variant="h5">
                {stats.totalSongs}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Rooms
              </Typography>
              <Typography variant="h5">
                {stats.totalRooms}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Interactions
              </Typography>
              <Typography variant="h5">
                {stats.totalInteractions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Unique Users
              </Typography>
              <Typography variant="h5">
                {stats.uniqueUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Download Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => downloadDataset('json')}
          disabled={loading}
        >
          Download Dataset (JSON)
        </Button>
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={() => downloadDataset('csv')}
          disabled={loading}
        >
          Download Dataset (CSV)
        </Button>
        {loading && <CircularProgress size={24} sx={{ ml: 2 }} />}
      </Box>
      
      {/* Tabs */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="Song Analytics" />
          <Tab label="Room Analytics" />
          <Tab label="Song Interactions" />
          <Tab label="Room Interactions" />
        </Tabs>
        
        {/* Song Analytics Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Top Songs by Popularity
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={topSongsData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="plays" fill="#8884d8" name="Play Count" />
                  <Bar dataKey="favorites" fill="#82ca9d" name="Favorite Count" />
                  <Bar dataKey="adds" fill="#ffc658" name="Add Count" />
                </BarChart>
              </ResponsiveContainer>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                Song Details
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'title'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'title', order: songFeaturesOrder.order }, 'title')}
                        >
                          Title
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'artist'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'artist', order: songFeaturesOrder.order }, 'artist')}
                        >
                          Artist
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'play_count'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'play_count', order: songFeaturesOrder.order }, 'play_count')}
                        >
                          Plays
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'favorite_count'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'favorite_count', order: songFeaturesOrder.order }, 'favorite_count')}
                        >
                          Favorites
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'add_count'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'add_count', order: songFeaturesOrder.order }, 'add_count')}
                        >
                          Adds
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={songFeaturesOrder.orderBy === 'room_count'}
                          direction={songFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'songFeatures', orderBy: 'room_count', order: songFeaturesOrder.order }, 'room_count')}
                        >
                          Rooms
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedSongFeatures.slice(0, 20).map((song) => (
                      <TableRow key={song.song_id}>
                        <TableCell>{song.title}</TableCell>
                        <TableCell>{song.artist}</TableCell>
                        <TableCell align="right">{song.play_count}</TableCell>
                        <TableCell align="right">{song.favorite_count}</TableCell>
                        <TableCell align="right">{song.add_count}</TableCell>
                        <TableCell align="right">{song.room_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </TabPanel>
        
        {/* Room Analytics Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Top Rooms by Activity
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={topRoomsData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="joins" fill="#8884d8" name="Join Count" />
                  <Bar dataKey="favorites" fill="#82ca9d" name="Favorite Count" />
                  <Bar dataKey="users" fill="#ffc658" name="Unique Users" />
                </BarChart>
              </ResponsiveContainer>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                Room Details
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={roomFeaturesOrder.orderBy === 'room_id'}
                          direction={roomFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'roomFeatures', orderBy: 'room_id', order: roomFeaturesOrder.order }, 'room_id')}
                        >
                          Room Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={roomFeaturesOrder.orderBy === 'join_count'}
                          direction={roomFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'roomFeatures', orderBy: 'join_count', order: roomFeaturesOrder.order }, 'join_count')}
                        >
                          Joins
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={roomFeaturesOrder.orderBy === 'favorite_count'}
                          direction={roomFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'roomFeatures', orderBy: 'favorite_count', order: roomFeaturesOrder.order }, 'favorite_count')}
                        >
                          Favorites
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={roomFeaturesOrder.orderBy === 'create_count'}
                          direction={roomFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'roomFeatures', orderBy: 'create_count', order: roomFeaturesOrder.order }, 'create_count')}
                        >
                          Creates
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">
                        <TableSortLabel
                          active={roomFeaturesOrder.orderBy === 'user_count'}
                          direction={roomFeaturesOrder.order}
                          onClick={() => handleSortRequest({ name: 'roomFeatures', orderBy: 'user_count', order: roomFeaturesOrder.order }, 'user_count')}
                        >
                          Users
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedRoomFeatures.slice(0, 20).map((room) => (
                      <TableRow key={room.room_id}>
                        <TableCell>{room.room_id}</TableCell>
                        <TableCell align="right">{room.join_count}</TableCell>
                        <TableCell align="right">{room.favorite_count}</TableCell>
                        <TableCell align="right">{room.create_count}</TableCell>
                        <TableCell align="right">{room.user_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </TabPanel>
        
        {/* Song Interactions Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Recent Song Interactions
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'user_id'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'user_id', order: songInteractionsOrder.order }, 'user_id')}
                      >
                        User
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'action'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'action', order: songInteractionsOrder.order }, 'action')}
                      >
                        Action
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'song_title'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'song_title', order: songInteractionsOrder.order }, 'song_title')}
                      >
                        Song
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'artist'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'artist', order: songInteractionsOrder.order }, 'artist')}
                      >
                        Artist
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'room_id'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'room_id', order: songInteractionsOrder.order }, 'room_id')}
                      >
                        Room
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={songInteractionsOrder.orderBy === 'timestamp'}
                        direction={songInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'songInteractions', orderBy: 'timestamp', order: songInteractionsOrder.order }, 'timestamp')}
                      >
                        Timestamp
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedSongInteractions.slice(0, 50).map((interaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{interaction.user_id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={interaction.action} 
                          color={
                            interaction.action === 'play_song' ? 'success' :
                            interaction.action === 'pause_song' ? 'warning' :
                            interaction.action === 'favorite_song' ? 'primary' :
                            interaction.action === 'add_song' ? 'info' : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{interaction.song_title || 'Unknown'}</TableCell>
                      <TableCell>{interaction.artist || 'Unknown'}</TableCell>
                      <TableCell>{interaction.room_id || 'N/A'}</TableCell>
                      <TableCell>{interaction.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
        
        {/* Room Interactions Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Recent Room Interactions
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={roomInteractionsOrder.orderBy === 'user_id'}
                        direction={roomInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'roomInteractions', orderBy: 'user_id', order: roomInteractionsOrder.order }, 'user_id')}
                      >
                        User
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={roomInteractionsOrder.orderBy === 'action'}
                        direction={roomInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'roomInteractions', orderBy: 'action', order: roomInteractionsOrder.order }, 'action')}
                      >
                        Action
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={roomInteractionsOrder.orderBy === 'room_id'}
                        direction={roomInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'roomInteractions', orderBy: 'room_id', order: roomInteractionsOrder.order }, 'room_id')}
                      >
                        Room
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={roomInteractionsOrder.orderBy === 'is_host'}
                        direction={roomInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'roomInteractions', orderBy: 'is_host', order: roomInteractionsOrder.order }, 'is_host')}
                      >
                        Is Host
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={roomInteractionsOrder.orderBy === 'timestamp'}
                        direction={roomInteractionsOrder.order}
                        onClick={() => handleSortRequest({ name: 'roomInteractions', orderBy: 'timestamp', order: roomInteractionsOrder.order }, 'timestamp')}
                      >
                        Timestamp
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRoomInteractions.slice(0, 50).map((interaction, index) => (
                    <TableRow key={index}>
                      <TableCell>{interaction.user_id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={interaction.action} 
                          color={
                            interaction.action === 'join_room' ? 'success' :
                            interaction.action === 'leave_room' ? 'warning' :
                            interaction.action === 'create_room' ? 'primary' :
                            interaction.action === 'favorite_room' ? 'info' : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{interaction.room_id}</TableCell>
                      <TableCell>{interaction.is_host ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{interaction.timestamp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;

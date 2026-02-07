import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [sheets, setSheets] = useState({
    friday: { rdo: null, days_ext: null, nights_ext: null },
    saturday: { rdo: null, days_ext: null, nights_ext: null },
    sunday: { rdo: null, days_ext: null, nights_ext: null }
  });
  const [loading, setLoading] = useState(true);
  const [versionLogs, setVersionLogs] = useState([]);
  const [bumpedOfficers, setBumpedOfficers] = useState([]);

  const fetchOfficers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/officers`);
      setOfficers(response.data);
    } catch (error) {
      console.error('Error fetching officers:', error);
    }
  }, []);

  const fetchSheet = useCallback(async (day, sheetType) => {
    try {
      const response = await axios.get(`${API}/sheets/${day}/${sheetType}`);
      setSheets(prev => ({
        ...prev,
        [day]: { ...prev[day], [sheetType]: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${day}/${sheetType} sheet:`, error);
    }
  }, []);

  const updateSheet = useCallback(async (day, sheetType, sheetData) => {
    try {
      const response = await axios.put(`${API}/sheets/${day}/${sheetType}`, sheetData);
      setSheets(prev => ({
        ...prev,
        [day]: { ...prev[day], [sheetType]: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error(`Error updating ${day}/${sheetType} sheet:`, error);
    }
  }, []);

  const resetAllSheets = useCallback(async () => {
    try {
      await axios.post(`${API}/sheets/reset`);
      const days = ['friday', 'saturday', 'sunday'];
      const types = ['rdo', 'days_ext', 'nights_ext'];
      for (const day of days) {
        for (const type of types) {
          await fetchSheet(day, type);
        }
      }
      return true;
    } catch (error) {
      console.error('Error resetting sheets:', error);
      return false;
    }
  }, [fetchSheet]);

  const login = useCallback(async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      if (response.data.success) {
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return { success: false, message: 'Login failed' };
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const addOfficer = useCallback(async (officerData) => {
    try {
      const response = await axios.post(`${API}/officers`, officerData);
      await fetchOfficers();
      return response.data;
    } catch (error) {
      console.error('Error adding officer:', error);
      throw error;
    }
  }, [fetchOfficers]);

  const updateOfficer = useCallback(async (officerId, officerData) => {
    try {
      const response = await axios.put(`${API}/officers/${officerId}`, officerData);
      await fetchOfficers();
      return response.data;
    } catch (error) {
      console.error('Error updating officer:', error);
      throw error;
    }
  }, [fetchOfficers]);

  const deleteOfficer = useCallback(async (officerId) => {
    try {
      await axios.delete(`${API}/officers/${officerId}`);
      await fetchOfficers();
      return true;
    } catch (error) {
      console.error('Error deleting officer:', error);
      throw error;
    }
  }, [fetchOfficers]);

  const fetchVersionLogs = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/version-logs`);
      setVersionLogs(response.data);
    } catch (error) {
      console.error('Error fetching version logs:', error);
    }
  }, []);

  const fetchBumpedOfficers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/bumped-officers`);
      setBumpedOfficers(response.data);
    } catch (error) {
      console.error('Error fetching bumped officers:', error);
    }
  }, []);

  const addBumpedOfficer = useCallback(async (bumpedData) => {
    try {
      await axios.post(`${API}/bumped-officers`, bumpedData);
      await fetchBumpedOfficers();
    } catch (error) {
      console.error('Error adding bumped officer:', error);
    }
  }, [fetchBumpedOfficers]);

  const markBumpedNotified = useCallback(async (bumpedId) => {
    try {
      await axios.put(`${API}/bumped-officers/${bumpedId}/notified`);
      await fetchBumpedOfficers();
    } catch (error) {
      console.error('Error marking bumped officer notified:', error);
    }
  }, [fetchBumpedOfficers]);

  const deleteBumpedRecord = useCallback(async (bumpedId) => {
    try {
      await axios.delete(`${API}/bumped-officers/${bumpedId}`);
      await fetchBumpedOfficers();
    } catch (error) {
      console.error('Error deleting bumped record:', error);
    }
  }, [fetchBumpedOfficers]);

  const clearAllBumped = useCallback(async () => {
    try {
      await axios.delete(`${API}/bumped-officers`);
      await fetchBumpedOfficers();
    } catch (error) {
      console.error('Error clearing bumped officers:', error);
    }
  }, [fetchBumpedOfficers]);

  const lockSheet = useCallback(async (day, sheetType) => {
    try {
      await axios.post(`${API}/sheets/${day}/${sheetType}/lock`);
      await fetchSheet(day, sheetType);
    } catch (error) {
      console.error('Error locking sheet:', error);
    }
  }, [fetchSheet]);

  const unlockSheet = useCallback(async (day, sheetType) => {
    try {
      await axios.post(`${API}/sheets/${day}/${sheetType}/unlock`);
      await fetchSheet(day, sheetType);
    } catch (error) {
      console.error('Error unlocking sheet:', error);
    }
  }, [fetchSheet]);

  const seedOfficers = useCallback(async () => {
    try {
      await axios.post(`${API}/seed`);
      await fetchOfficers();
    } catch (error) {
      console.error('Error seeding officers:', error);
    }
  }, [fetchOfficers]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await seedOfficers();
      await fetchOfficers();
      const days = ['friday', 'saturday', 'sunday'];
      const types = ['rdo', 'days_ext', 'nights_ext'];
      for (const day of days) {
        for (const type of types) {
          await fetchSheet(day, type);
        }
      }
      await fetchBumpedOfficers();
      setLoading(false);
    };
    init();
  }, [seedOfficers, fetchOfficers, fetchSheet, fetchBumpedOfficers]);

  const getAllAssignedOfficerIds = useCallback(() => {
    const ids = new Set();
    Object.values(sheets).forEach(daySheets => {
      Object.values(daySheets).forEach(sheet => {
        if (sheet?.rows) {
          sheet.rows.forEach(row => {
            ['assignment_a', 'assignment_b', 'assignment_c', 'assignment_d', 'assignment_e', 'assignment_f'].forEach(key => {
              if (row[key]?.officer_id) {
                ids.add(row[key].officer_id);
              }
            });
          });
        }
      });
    });
    return ids;
  }, [sheets]);

  const checkDuplicate = useCallback((officerId, currentDay, currentSheetType, currentRowId, currentAssignmentKey) => {
    let count = 0;
    Object.entries(sheets).forEach(([day, daySheets]) => {
      Object.entries(daySheets).forEach(([sheetType, sheet]) => {
        if (sheet?.rows) {
          sheet.rows.forEach(row => {
            ['assignment_a', 'assignment_b', 'assignment_c', 'assignment_d', 'assignment_e', 'assignment_f'].forEach(key => {
              if (row[key]?.officer_id === officerId) {
                count++;
              }
            });
          });
        }
      });
    });
    return count > 1;
  }, [sheets]);

  return (
    <AppContext.Provider value={{
      isAuthenticated,
      officers,
      sheets,
      loading,
      versionLogs,
      login,
      logout,
      fetchOfficers,
      fetchSheet,
      updateSheet,
      resetAllSheets,
      addOfficer,
      updateOfficer,
      deleteOfficer,
      fetchVersionLogs,
      getAllAssignedOfficerIds,
      checkDuplicate
    }}>
      {children}
    </AppContext.Provider>
  );
};

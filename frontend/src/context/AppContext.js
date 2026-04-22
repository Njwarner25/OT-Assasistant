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

  const fetchSheet = useCallback(async (day, sheetType, period = 'P1') => {
    try {
      const response = await axios.get(`${API}/sheets/${period}/${day}/${sheetType}`);
      setSheets(prev => ({
        ...prev,
        [day]: { ...prev[day], [sheetType]: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${period}/${day}/${sheetType} sheet:`, error);
    }
  }, []);

  const updateSheet = useCallback(async (day, sheetType, sheetData, period = 'P1') => {
    try {
      const response = await axios.put(`${API}/sheets/${period}/${day}/${sheetType}`, sheetData);
      setSheets(prev => ({
        ...prev,
        [day]: { ...prev[day], [sheetType]: response.data }
      }));
      return response.data;
    } catch (error) {
      console.error(`Error updating ${period}/${day}/${sheetType} sheet:`, error);
    }
  }, []);

  const resetAllSheets = useCallback(async (period = 'P1') => {
    try {
      await axios.post(`${API}/sheets/reset`, null, { params: { period } });
      const days = ['thursday', 'friday', 'saturday', 'sunday'];
      const types = ['rdo', 'days_ext', 'nights_ext'];
      for (const day of days) {
        for (const type of types) {
          await fetchSheet(day, type, period);
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

  const lockSheet = useCallback(async (day, sheetType, period = 'P1') => {
    try {
      await axios.post(`${API}/sheets/${period}/${day}/${sheetType}/lock`);
      await fetchSheet(day, sheetType, period);
    } catch (error) {
      console.error('Error locking sheet:', error);
    }
  }, [fetchSheet]);

  const unlockSheet = useCallback(async (day, sheetType, period = 'P1') => {
    try {
      await axios.post(`${API}/sheets/${period}/${day}/${sheetType}/unlock`);
      await fetchSheet(day, sheetType, period);
    } catch (error) {
      console.error('Error unlocking sheet:', error);
    }
  }, [fetchSheet]);

  const setAutoLock = useCallback(async (day, sheetType, autoLockTime, autoLockEnabled, period = 'P1') => {
    try {
      await axios.post(`${API}/sheets/${period}/${day}/${sheetType}/set-auto-lock`, {
        auto_lock_time: autoLockTime,
        auto_lock_enabled: autoLockEnabled
      });
      await fetchSheet(day, sheetType, period);
    } catch (error) {
      console.error('Error setting auto-lock:', error);
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
            if (row.assignment_a?.officer_id) {
              ids.add(row.assignment_a.officer_id);
            }
          });
        }
      });
    });
    return ids;
  }, [sheets]);

  const checkDuplicate = useCallback((officerId, day) => {
    if (!officerId || !day) return false;
    let count = 0;
    const daySheets = sheets[day];
    if (daySheets) {
      Object.values(daySheets).forEach(sheet => {
        if (sheet?.rows) {
          sheet.rows.forEach(row => {
            if (row.assignment_a?.officer_id === officerId) {
              count++;
            }
          });
        }
      });
    }
    return count > 1;
  }, [sheets]);

  return (
    <AppContext.Provider value={{
      isAuthenticated,
      officers,
      sheets,
      loading,
      versionLogs,
      bumpedOfficers,
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
      fetchBumpedOfficers,
      addBumpedOfficer,
      markBumpedNotified,
      deleteBumpedRecord,
      clearAllBumped,
      lockSheet,
      unlockSheet,
      setAutoLock,
      getAllAssignedOfficerIds,
      checkDuplicate
    }}>
      {children}
    </AppContext.Provider>
  );
};

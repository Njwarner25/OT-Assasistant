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

  const fetchOfficers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/officers`);
      setOfficers(response.data);
    } catch (error) {
      console.error('Error fetching officers:', error);
    }
  }, []);

  const fetchSheet = useCallback(async (sheetType) => {
    try {
      const response = await axios.get(`${API}/sheets/${sheetType}`);
      setSheets(prev => ({ ...prev, [sheetType]: response.data }));
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${sheetType} sheet:`, error);
    }
  }, []);

  const updateSheet = useCallback(async (sheetType, sheetData) => {
    try {
      const response = await axios.put(`${API}/sheets/${sheetType}`, sheetData);
      setSheets(prev => ({ ...prev, [sheetType]: response.data }));
      return response.data;
    } catch (error) {
      console.error(`Error updating ${sheetType} sheet:`, error);
    }
  }, []);

  const resetAllSheets = useCallback(async () => {
    try {
      await axios.post(`${API}/sheets/reset`);
      await Promise.all([
        fetchSheet('rdo'),
        fetchSheet('days_ext'),
        fetchSheet('nights_ext')
      ]);
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
      await Promise.all([
        fetchSheet('rdo'),
        fetchSheet('days_ext'),
        fetchSheet('nights_ext')
      ]);
      setLoading(false);
    };
    init();
  }, [seedOfficers, fetchOfficers, fetchSheet]);

  const getAllAssignedOfficerIds = useCallback(() => {
    const ids = new Set();
    Object.values(sheets).forEach(sheet => {
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
    return ids;
  }, [sheets]);

  const checkDuplicate = useCallback((officerId, currentSheetType, currentRowId, currentAssignmentKey) => {
    let count = 0;
    Object.entries(sheets).forEach(([sheetType, sheet]) => {
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

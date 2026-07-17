const DB_NAME = 'astral-learning-cache';
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('modules')) {
        const store = db.createObjectStore('modules', { keyPath: 'id' });
        store.createIndex('course_id', 'course_id', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveCourseToCache(course: any) {
  if (!course) return;
  try {
    const db = await openDB();
    const tx = db.transaction('courses', 'readwrite');
    const store = tx.objectStore('courses');
    
    // Strip any functions or un-serializable fields
    const serializedCourse = JSON.parse(JSON.stringify(course));
    
    store.put({
      ...serializedCourse,
      cached_at: new Date().toISOString()
    });
    
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save course to IndexedDB cache", err);
  }
}

export async function getCourseFromCache(courseId: string): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('courses', 'readonly');
    const store = tx.objectStore('courses');
    const request = store.get(courseId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get course from IndexedDB cache", err);
    return null;
  }
}

export async function saveModulesToCache(courseId: string, modules: any[]) {
  if (!courseId || !modules || modules.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction('modules', 'readwrite');
    const store = tx.objectStore('modules');
    
    // Strip any functions or un-serializable fields
    const serializedModules = JSON.parse(JSON.stringify(modules));
    
    for (const mod of serializedModules) {
      store.put({
        ...mod,
        course_id: courseId,
        cached_at: new Date().toISOString()
      });
    }
    
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save modules to IndexedDB cache", err);
  }
}

export async function getModulesFromCache(courseId: string): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction('modules', 'readonly');
    const store = tx.objectStore('modules');
    const index = store.index('course_id');
    const request = index.getAll(courseId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result || [];
        // Sort modules by order_index to keep correct display order
        results.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get modules from IndexedDB cache", err);
    return [];
  }
}

export async function getSingleModuleFromCache(moduleId: string): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('modules', 'readonly');
    const store = tx.objectStore('modules');
    const request = store.get(moduleId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get single module from IndexedDB cache", err);
    return null;
  }
}

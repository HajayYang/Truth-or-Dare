import { questions, type Question } from '../data/questions'

/** Seed the bundled question bank into a real, local IndexedDB database. */
export async function loadQuestionBank(): Promise<Question[]> {
  if (!('indexedDB' in window)) return questions
  let request: IDBOpenDBRequest
  try { request = window.indexedDB.open('after-hours-questions', 1) }
  catch { return questions }
  return new Promise((resolve) => {
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('questions', { keyPath: 'id' })
      store.createIndex('type', 'type')
      store.createIndex('gender', 'gender')
      questions.forEach((question) => store.put(question))
    }
    // Private browsing may forbid persistence; the bundled bank still works.
    request.onerror = () => resolve(questions)
    request.onsuccess = () => {
      const database = request.result
      const read = database.transaction('questions', 'readonly').objectStore('questions').getAll()
      read.onsuccess = () => {
        resolve(read.result.length === questions.length ? read.result : questions)
        database.close()
      }
      read.onerror = () => { database.close(); resolve(questions) }
    }
  })
}

import { useState, useEffect, useCallback } from 'react'

function formatDueDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(date)
  dueDate.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, className: 'overdue' }
  if (diffDays === 0) return { text: 'Today', className: 'today' }
  if (diffDays === 1) return { text: 'Tomorrow', className: '' }
  if (diffDays <= 7) return { text: `${diffDays} days`, className: '' }

  return { text: date.toLocaleDateString(), className: '' }
}

function TaskManager() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [activeTab, setActiveTab] = useState('pending')

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks?status=${activeTab}`)
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const data = await response.json()
      setTasks(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          due_date: new Date().toISOString().split('T')[0],
          task_type: 'maintenance'
        })
      })

      if (!response.ok) throw new Error('Failed to add task')

      setNewTaskTitle('')
      fetchTasks()
    } catch (err) {
      alert('Failed to add task: ' + err.message)
    }
  }

  const handleToggleTask = async (task) => {
    try {
      const endpoint = task.completed_at
        ? `/api/tasks/${task.id}/uncomplete`
        : `/api/tasks/${task.id}/complete`

      const response = await fetch(endpoint, { method: 'POST' })
      if (!response.ok) throw new Error('Failed to update task')

      fetchTasks()
    } catch (err) {
      alert('Failed to update task: ' + err.message)
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete task')
      fetchTasks()
    } catch (err) {
      alert('Failed to delete task: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading tasks...
      </div>
    )
  }

  if (error) {
    return <div className="empty-state">Error loading tasks: {error}</div>
  }

  return (
    <div>
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
      </div>

      {activeTab === 'pending' && (
        <form className="add-task-form" onSubmit={handleAddTask}>
          <input
            type="text"
            className="input"
            placeholder="Add a new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">
          {activeTab === 'pending'
            ? 'No pending tasks. Add one above!'
            : 'No completed tasks yet.'}
        </div>
      ) : (
        <div className="tasks-list">
          {tasks.map(task => {
            const dueInfo = formatDueDate(task.due_date)

            return (
              <div
                key={task.id}
                className={`task-item ${task.completed_at ? 'completed' : ''}`}
              >
                <div
                  className={`task-checkbox ${task.completed_at ? 'checked' : ''}`}
                  onClick={() => handleToggleTask(task)}
                >
                  {task.completed_at && '✓'}
                </div>

                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    {task.task_type && (
                      <span className="task-type">{task.task_type}</span>
                    )}
                    {dueInfo.text && (
                      <span className={`task-due ${dueInfo.className}`}>
                        {dueInfo.text}
                      </span>
                    )}
                    {task.recurring && (
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        ↻ {task.recurring}
                      </span>
                    )}
                    {task.plant_name && (
                      <span>{task.plant_name}</span>
                    )}
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleDeleteTask(task.id)}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'pending' && (
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
            Quick add:
          </span>
          {['water', 'fertilize', 'harvest', 'maintenance'].map(type => (
            <button
              key={type}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              onClick={async () => {
                try {
                  const response = await fetch('/api/tasks/bulk/reminders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_type: type, recurring: 'weekly' })
                  })
                  if (response.ok) fetchTasks()
                } catch (err) {
                  alert('Failed to add reminder')
                }
              }}
            >
              + {type}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default TaskManager

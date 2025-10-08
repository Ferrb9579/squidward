import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { sendAgentCommand } from '../api/agent'
import { useDashboardStore } from '../store/dashboardStore'
import type { AgentAction } from '../types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const createMessage = (role: Message['role'], text: string): Message => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  role,
  text
})

const AgentAssistant = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      'assistant',
      'Hi! I can help you navigate the console—ask me to open the automations page, start a new automation, jump into the alert tester, or pull up a specific sensor.'
    )
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const hasBootstrappedRef = useRef(false)

  const selectSensor = useDashboardStore((state) => state.selectSensor)
  const sensors = useDashboardStore((state) => state.sensors)
  const initializeDashboard = useDashboardStore((state) => state.initialize)

  useEffect(() => {
    if (isOpen && !hasBootstrappedRef.current) {
      hasBootstrappedRef.current = true
      void initializeDashboard()
    }
  }, [isOpen, initializeDashboard])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleActions = (actions: AgentAction[]) => {
    actions.forEach((action) => {
      if (action.type === 'navigate' && action.path) {
        navigate(action.path)
        return
      }

      if (action.type === 'selectSensor') {
        const sensor = sensors.find((item) => item.id === action.sensorId)
        if (sensor) {
          selectSensor(sensor.id)
          navigate('/')
        } else {
          setMessages((prev) => [
            ...prev,
            createMessage(
              'assistant',
              "I couldn't find that sensor yet. Make sure it's available in the dashboard."
            )
          ])
        }
      }
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    setMessages((prev) => [...prev, createMessage('user', trimmed)])
    setInput('')
    setIsSending(true)

    try {
      const response = await sendAgentCommand(trimmed, location.pathname)
      setMessages((prev) => [...prev, createMessage('assistant', response.reply)])
      handleActions(response.actions)
    } catch (error) {
      console.error('Agent request failed', error)
      const fallback =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to reach the assistant right now.'
      setMessages((prev) => [...prev, createMessage('assistant', fallback)])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-80 rounded-2xl border border-slate-700/70 bg-slate-900/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
                <Bot size={16} />
              </span>
              Console assistant
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-100"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>
          <div ref={scrollRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === 'assistant'
                    ? 'self-start rounded-xl bg-slate-800/70 px-3 py-2 text-slate-100'
                    : 'self-end rounded-xl bg-sky-500/80 px-3 py-2 text-slate-900'
                }
              >
                {message.text}
              </div>
            ))}
            {isSending && (
              <div className="self-start rounded-xl bg-slate-800/70 px-3 py-2 text-slate-300">Thinking…</div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-700/60 px-4 py-3">
            <label htmlFor="agent-input" className="sr-only">
              Ask the assistant
            </label>
            <input
              id="agent-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/70 focus:outline-none"
              placeholder="Ask to navigate, create automations, or find a sensor"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/90 text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-sky-400"
      >
        <Bot size={16} />
        {isOpen ? 'Hide assistant' : 'Ask Hydrogrid'}
      </button>
    </div>
  )
}

export default AgentAssistant

import EmoCaptcha from '../components/EmoCaptcha'

export default function Home() {
  return (
    <div className="hero-surface min-h-screen w-full">
      <div className="relative mx-auto max-w-6xl px-6 py-14">
        <header className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              emoCAPTCHA
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Match the emoji with your face to prove you’re human.
            </p>
          </div>
        </header>

        <EmoCaptcha />
      </div>
    </div>
  )
}

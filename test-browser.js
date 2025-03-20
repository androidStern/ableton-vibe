import { Ableton } from 'ableton-js'
import { execSync } from 'child_process'

process.env.TMPDIR = execSync('getconf DARWIN_USER_TEMP_DIR').toString().trim()

async function main() {
  const ableton = new Ableton({ logger: console })
  console.info('Connecting to Ableton...')

  const exitTimeout = setTimeout(() => {
    console.error('Script timed out after 10 seconds, forcing exit')
    process.exit(1)
  }, 10000)

  try {
    await ableton.start(5000)
    const browser = ableton.application.browser

    const instruments = await browser.get('instruments')
    console.info(`Found ${instruments.length} instrument categories`)

    instruments.forEach((item, i) => {
      console.info(
        `Instrument Category ${i + 1}: ${item.raw.name} (loadable: ${item.raw.is_loadable})`
      )
    })

    const loadableCategory = instruments.find(item => item.raw.is_loadable)

    if (loadableCategory) {
      console.info(`Loading instrument: ${loadableCategory.raw.name}`)
      await browser.sendCommand('load_item', { id: loadableCategory.raw.id })
      console.info('Instrument loaded successfully')
    } else {
      console.info('No loadable instruments found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    clearTimeout(exitTimeout)
    console.info('Cleaning up and exiting...')

    try {
      if (ableton.client) {
        ableton.client.close()
      }
    } catch (e) {
      console.error('Error closing client:', e)
    }
    setTimeout(() => process.exit(0), 500)
  }
}

main()

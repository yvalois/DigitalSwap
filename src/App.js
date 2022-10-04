import styles from './styles/Home.module.css'
import SwapForm from './components/SwapForm'
import { Container } from '@mui/material'

function App() {
  return (
    <div className="App">
          <Container>
        <title>DigitalSwap</title>
        <link rel="icon" href="/favicon.ico" />


      <main className={styles.main}>
        <img className={styles.DigitalSwap} src="https://gateway.pinata.cloud/ipfs/QmXEfJ3YnJZ8yNw2hA4w1LLzy7qLvDRNrgiytvEK2bjf55" ></img>

        <SwapForm />
      </main>

      <footer className={styles.footer}>
        <a
          href="https://pegdex.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by <span className={styles.logo}>PegDex!</span>
        </a>
      </footer>
    </Container>
    </div>
  );
}

export default App;

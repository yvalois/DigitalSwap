import styles from './styles/Home.module.css'
import SwapForm from './components/SwapForm'
import { Container } from '@mui/material'

function App() {
  return (
    <div className="App">
          <Container>
        <title>PegDex</title>
        <link rel="icon" href="/favicon.ico" />


      <main className={styles.main}>
        <img src="https://cdn.decrypt.co/wp-content/uploads/2022/05/ethereum-eth2-themerge-gID_1.jpg.webp" width={"200px"}></img>
        <p className={styles.description}>Swap your favorite tokens!</p>

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

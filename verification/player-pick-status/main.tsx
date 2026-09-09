import React from 'react';
import {createRoot} from 'react-dom/client';
import {Fixture} from './fixtures';
import Panel from '../../src/features/games/PlayerPickStatusPanel';
import '../../src/components/steel/steel.css';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(location.search === '?mobile'
  ? <iframe title="Phone layout" src="?narrow" style={{width:390,height:900,border:0}} />
  : <React.StrictMode><Fixture><Panel/></Fixture></React.StrictMode>);

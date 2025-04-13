import React, {useEffect, useState} from 'react';
import {Box, Text, useApp, useFocus, useInput} from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

function Input() {
	const [query, setQuery] = useState('');

	const {isFocused, focus} = useFocus({autoFocus: true});

	useEffect(() => {
		focus('prompt');
	}, []);

	return (
		<Box
			borderStyle="single"
			// borderTop={false}
			// borderBottom={true}
			// borderLeft={false}
			// borderRight={false}
			borderColor={isFocused ? 'white' : 'gray'}
			borderDimColor
		>
			<Box marginRight={1}>
				<Text color="white" dimColor>
					{'|>'}
				</Text>
			</Box>
			<TextInput value={query} onChange={setQuery} />
		</Box>
	);
}

function Output() {
	const {isFocused} = useFocus();

	return (
		<Box
			flexDirection="column"
			borderStyle="single"
			borderColor={isFocused ? 'white' : 'gray'}
			borderDimColor
		>
			<Box>
				<Spinner type="dots" />
			</Box>

			<Text>START</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>cost:</Text>
			<Text color="magenta" dimColor>
				$0.01
			</Text>
			<Text>END</Text>
		</Box>
	);
}

function Status() {
	const {isFocused} = useFocus();

	return (
		<Box
			flexDirection="row"
			justifyContent="space-between"
			borderStyle="single"
			borderColor={isFocused ? 'white' : 'gray'}
			paddingX={1}
		>
			<Box justifyContent="space-between" marginRight={4} gap={2}>
				<Text>model:</Text>
				<Text color={isFocused ? 'redBright' : 'magenta'} dimColor italic>
					gemini/gemini-2.5-pro-preview
				</Text>
			</Box>

			<Box justifyContent="space-between" marginRight={4} gap={2}>
				<Text>cost:</Text>
				<Text color="magenta" dimColor>
					$0.01
				</Text>
			</Box>
			<Box justifyContent="space-between" gap={2}>
				<Text>tokens:</Text>
				<Text color="blueBright" dimColor>
					1,000,000
				</Text>
			</Box>
		</Box>
	);
}

export default function App() {
	const {exit} = useApp();

	useInput(input => {
		if (input === 'q') {
			exit();
		}
	});

	return (
		<Box flexDirection="column" paddingTop={1} paddingBottom={1}>
			<Output />

			<Status />

			<Input />
		</Box>
	);
}

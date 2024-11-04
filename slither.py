import subprocess
import json
import os

def run_slither(contract_path, json_output_path):
    """Run Slither on the given contract and save the JSON output to a file."""
    try:
        result = subprocess.run(['slither', contract_path, '--json', json_output_path], capture_output=True, text=True, check=True)
        if result.stderr:
            print(f"Standard Error: {result.stderr}")
        return json_output_path
    except subprocess.CalledProcessError as e:
        print(f"Error running Slither: {e}")
        print(f"Standard Output: {e.stdout}")
        print(f"Standard Error: {e.stderr}")
        return None

def parse_slither_output(json_output_path):
    """Parse the Slither JSON output file and extract vulnerabilities."""
    vulnerabilities = []
    try:
        with open(json_output_path, 'r') as f:
            data = json.load(f)
            # Extracting vulnerabilities from Slither output
            for file in data.get('files', []):
                for contract in file.get('contracts', []):
                    for func in contract.get('functions', []):
                        for issue in func.get('issues', []):
                            vulnerability = {
                                'file': file['file'],
                                'contract': contract['contract'],
                                'function': func['function'],
                                'issue': issue['description'],
                                'severity': issue.get('severity', 'unknown')
                            }
                            vulnerabilities.append(vulnerability)
    except json.JSONDecodeError as e:
        print(f"Error parsing Slither output: {e}")
    except IOError as e:
        print(f"Error reading Slither output file: {e}")
    return vulnerabilities

def write_vulnerabilities_to_file(vulnerabilities, output_file):
    """Write the vulnerabilities to a JSON file."""
    with open(output_file, 'w') as f:
        json.dump(vulnerabilities, f, indent=4)
    print(f"Vulnerabilities written to {output_file}")

def main(contract_path, output_file):
    # json_output_path='./slither_output.json'
    json_output_path = output_file
    # Run Slither and get JSON output file path
    slither_output_path = run_slither(contract_path, json_output_path)
    if slither_output_path:
        # Parse the JSON output file
        vulnerabilities = parse_slither_output(slither_output_path)
        # Write the vulnerabilities to the final output file
        write_vulnerabilities_to_file(vulnerabilities, output_file)
        # Clean up temporary JSON output file
        os.remove(json_output_path)

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python script.py <contract_path> <output_file>")
    else:
        contract_path = sys.argv[1]
        output_file = sys.argv[2]
        main(contract_path, output_file)

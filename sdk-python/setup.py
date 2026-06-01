from setuptools import setup, find_packages

setup(
    name="traceflow-sdk",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.0",
    ],
    extras_require={
        "fastapi": ["fastapi", "starlette"],
        "flask": ["flask"],
        "django": ["django"],
    },
)
